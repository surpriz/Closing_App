import { generateText, Output } from "ai";
import { z } from "zod";

import { lintFollowup } from "./guard";
import { buildFollowupPrompt, FOLLOWUP_SYSTEM_PROMPT, type FollowupPromptInput } from "./prompts";
import { getLanguageModel } from "./provider";
import { templateFollowup, type FollowupDraft } from "./templates";
import { recordAiUsage } from "./usage";

// No length bounds: providers drop them from the enforced schema, and a parse
// failure would lose the message. The guard checks length instead.
const draftSchema = z.object({
  subject: z.string().nullable(),
  body: z.string(),
});

export type GeneratedFollowup = FollowupDraft & {
  aiProvider: string;
  aiModel: string | null;
  /** Problems the guard still found; the message then needs the seller's eye. */
  issues: string[];
  /** True when the first version passed the guard as is. */
  passedFirstTry: boolean;
};

function fromTemplate(input: FollowupPromptInput, issues: string[] = []): GeneratedFollowup {
  return { ...templateFollowup(input), aiProvider: "template", aiModel: null, issues, passedFirstTry: issues.length === 0 };
}

const MAX_ATTEMPTS = 2;

export async function draftFollowup(
  input: FollowupPromptInput,
  { sourceText, organizationId, linkId }: { sourceText: string; organizationId: string; linkId: string },
): Promise<GeneratedFollowup> {
  const llm = getLanguageModel("followup");
  if (!llm) return fromTemplate(input);

  let issues: string[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const startedAt = Date.now();
    try {
      const { output, usage } = await generateText({
        model: llm.model,
        system: FOLLOWUP_SYSTEM_PROMPT,
        prompt: buildFollowupPrompt({ ...input, fixIssues: issues }),
        output: Output.object({ schema: draftSchema }),
        // Room for the model's thinking, the message itself stays short
        maxOutputTokens: 3000,
        abortSignal: AbortSignal.timeout(45_000),
      });
      await recordAiUsage({
        organizationId,
        linkId,
        purpose: "followup",
        provider: llm.provider,
        modelId: llm.modelId,
        usage,
        latencyMs: Date.now() - startedAt,
        ok: true,
      });

      // The link is the whole point of the message: never ship one without it
      const body = output.body.includes(input.proposalUrl) ? output.body : `${output.body}\n\n${input.proposalUrl}`;
      const draft = {
        subject: input.channel === "WHATSAPP" ? null : output.subject || templateFollowup(input).subject,
        body,
      };

      issues = lintFollowup(draft, { channel: input.channel, proposalUrl: input.proposalUrl, sourceText }).map(
        (issue) => issue.message,
      );
      if (issues.length === 0) {
        return { ...draft, aiProvider: llm.provider, aiModel: llm.modelId, issues, passedFirstTry: attempt === 1 };
      }
    } catch (error) {
      console.error("[followups] AI generation failed, using template", error);
      await recordAiUsage({
        organizationId,
        linkId,
        purpose: "followup",
        provider: llm.provider,
        modelId: llm.modelId,
        latencyMs: Date.now() - startedAt,
        ok: false,
      });
      return fromTemplate(input);
    }
  }

  // Two versions broke a rule: a safe template, flagged for the seller
  return fromTemplate(input, issues);
}
