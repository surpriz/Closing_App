import { generateText, Output } from "ai";
import { z } from "zod";

import { buildFollowupPrompt, FOLLOWUP_SYSTEM_PROMPT, type FollowupPromptInput } from "./prompts";
import { getLanguageModel } from "./provider";
import { templateFollowup, type FollowupDraft } from "./templates";

const draftSchema = z.object({
  subject: z.string().max(120).nullable(),
  body: z.string().min(1).max(2000),
});

export type GeneratedFollowup = FollowupDraft & {
  aiProvider: string;
  aiModel: string | null;
};

function fromTemplate(input: FollowupPromptInput): GeneratedFollowup {
  return { ...templateFollowup(input), aiProvider: "template", aiModel: null };
}

export async function draftFollowup(input: FollowupPromptInput): Promise<GeneratedFollowup> {
  const llm = getLanguageModel("followup");
  if (!llm) return fromTemplate(input);

  try {
    const { output } = await generateText({
      model: llm.model,
      system: FOLLOWUP_SYSTEM_PROMPT,
      prompt: buildFollowupPrompt(input),
      output: Output.object({ schema: draftSchema }),
      maxOutputTokens: 800,
    });

    // The link is the whole point of the message: never ship one without it
    const body = output.body.includes(input.proposalUrl)
      ? output.body
      : `${output.body}\n\n${input.proposalUrl}`;

    return {
      subject: input.channel === "WHATSAPP" ? null : output.subject || templateFollowup(input).subject,
      body,
      aiProvider: llm.provider,
      aiModel: llm.modelId,
    };
  } catch (error) {
    console.error("[followups] AI generation failed, using template", error);
    return fromTemplate(input);
  }
}
