import { generateText, Output } from "ai";
import { z } from "zod";

import { lintFollowup } from "@/lib/closing/ai/guard";
import { getLanguageModel } from "@/lib/closing/ai/provider";
import { recordAiUsage } from "@/lib/closing/ai/usage";
import { getWorkspaceSettings } from "@/lib/closing/settings";
import { prisma } from "@/lib/db";

import { buildOutreachPrompt, OUTREACH_SYSTEM_PROMPT, templateOutreach, type OutreachDraft, type OutreachInput } from "./hook-prompt";
import { pickReference } from "./reference";

const draftSchema = z.object({ subject: z.string(), body: z.string() });
const MAX_ATTEMPTS = 2;

/** Customers of the workspace that agreed to be named, with their sector when the registry knows it. */
async function referenceFor(organizationId: string, prospectSiren: string | null) {
  const links = await prisma.link.findMany({
    where: { organizationId, dealStatus: "WON", referenceConsentAt: { not: null }, archivedAt: null },
    select: { name: true, referenceConsentAt: true, prospects: { select: { email: true, company: true }, take: 1 } },
    take: 20,
  });
  if (links.length === 0) return null;

  const domains = links.map((l) => l.prospects[0]?.email.split("@")[1]).filter((d): d is string => !!d);
  const [lookups, prospectCompany] = await Promise.all([
    prisma.companyLookup.findMany({ where: { key: { in: domains.map((d) => `domain:${d.toLowerCase()}`) } } }),
    prospectSiren ? prisma.companyLookup.findFirst({ where: { siren: prospectSiren }, select: { naf: true } }) : null,
  ]);
  const nafByDomain = new Map(lookups.map((l) => [l.key.slice("domain:".length), l.naf]));

  return pickReference(
    links.map((link) => {
      const prospect = link.prospects[0];
      return {
        company: prospect?.company || link.name || "",
        naf: prospect ? (nafByDomain.get(prospect.email.split("@")[1]?.toLowerCase() ?? "") ?? null) : null,
        consentAt: link.referenceConsentAt,
      };
    }),
    prospectCompany?.naf ?? null,
  );
}

/** First message for a ready contact: AI when configured, checked by the guard, template otherwise. */
export async function draftOutreach(input: {
  organizationId: string;
  linkId: string;
  proposalUrl: string;
  documentTitle: string;
  prospect: OutreachInput["prospect"];
  prospectSiren: string | null;
}): Promise<OutreachDraft & { aiProvider: string }> {
  const [settings, reference] = await Promise.all([
    getWorkspaceSettings(input.organizationId),
    referenceFor(input.organizationId, input.prospectSiren),
  ]);
  const prompt: OutreachInput = {
    prospect: input.prospect,
    offer: {
      description: settings.offerDescription,
      valueProps: settings.valueProps,
      targetCustomer: settings.targetCustomer,
    },
    documentTitle: input.documentTitle,
    proposalUrl: input.proposalUrl,
    senderName: settings.senderName,
    signature: settings.senderSignature,
    reference,
  };
  // What the message may quote: anything else is an invented fact
  const sourceText = [settings.offerDescription, settings.valueProps, settings.targetCustomer, input.documentTitle, reference]
    .filter(Boolean)
    .join("\n");

  const llm = getLanguageModel("followup");
  if (!llm) return { ...templateOutreach(prompt), aiProvider: "template" };

  let issues: string[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const startedAt = Date.now();
    try {
      const { output, usage } = await generateText({
        model: llm.model,
        system: OUTREACH_SYSTEM_PROMPT,
        prompt: buildOutreachPrompt({ ...prompt, fixIssues: issues }),
        output: Output.object({ schema: draftSchema }),
        maxOutputTokens: 3000,
        abortSignal: AbortSignal.timeout(45_000),
      });
      await recordAiUsage({
        organizationId: input.organizationId,
        linkId: input.linkId,
        purpose: "followup",
        provider: llm.provider,
        modelId: llm.modelId,
        usage,
        latencyMs: Date.now() - startedAt,
        ok: true,
      });
      const body = output.body.includes(input.proposalUrl) ? output.body : `${output.body}\n\n${input.proposalUrl}`;
      const draft = { subject: output.subject.trim() || templateOutreach(prompt).subject, body };
      issues = lintFollowup(draft, { channel: "EMAIL", proposalUrl: input.proposalUrl, sourceText, locale: "fr" }).map((i) => i.message);
      if (issues.length === 0) return { ...draft, aiProvider: llm.provider };
    } catch (error) {
      console.error("[prospecting:hook] AI generation failed, using template", error);
      await recordAiUsage({
        organizationId: input.organizationId,
        linkId: input.linkId,
        purpose: "followup",
        provider: llm.provider,
        modelId: llm.modelId,
        latencyMs: Date.now() - startedAt,
        ok: false,
      });
      break;
    }
  }
  return { ...templateOutreach(prompt), aiProvider: "template" };
}
