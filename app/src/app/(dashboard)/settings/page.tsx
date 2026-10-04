import type { Metadata } from "next";

import { ExtensionTokens } from "@/components/dashboard/extension-tokens";
import { PageHeader } from "@/components/dashboard/page-header";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { getLanguageModel } from "@/lib/closing/ai/provider";
import { getWorkspaceSettings } from "@/lib/closing/settings";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { isEmailConfigured } from "@/lib/email";
import { requireWorkspace } from "@/lib/session";

function safeDecrypt(value: string | null) {
  if (!value) return null;
  try {
    return decryptSecret(value);
  } catch {
    return null;
  }
}

export const metadata: Metadata = { title: "Réglages" };

const SECTIONS = [
  { id: "pilote", label: "Pilote automatique" },
  { id: "offre", label: "Votre offre" },
  { id: "messages", label: "Vos messages" },
  { id: "alertes", label: "Être prévenu" },
  { id: "extension", label: "Extension Chrome" },
];

export default async function SettingsPage() {
  const { user, organization } = await requireWorkspace();
  const [settings, tokens] = await Promise.all([
    getWorkspaceSettings(organization.id),
    prisma.extensionToken.findMany({
      where: { userId: user.id, organizationId: organization.id, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, label: true, hint: true, createdAt: true, lastUsedAt: true },
    }),
  ]);
  const llm = getLanguageModel("followup");

  return (
    <div className="space-y-10">
      <PageHeader title="Réglages" description={`Le pilote automatique de l'espace ${organization.name}.`} />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[11rem_minmax(0,1fr)]">
        <nav aria-label="Sections des réglages" className="hidden lg:block">
          <ul className="sticky top-24 space-y-0.5 text-sm">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors outline-none hover:bg-foreground/[0.04] hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-10">
          <SettingsForm
            initial={{
              version: settings.updatedAt.toISOString(),
              alertChannels: settings.alertChannels,
              alertEmail: settings.alertEmail ?? "",
              slackConfigured: !!settings.slackWebhookUrl,
              outboundWebhookUrl: settings.outboundWebhookUrl ?? "",
              webhookSecret: safeDecrypt(settings.webhookSecret),
              aiTone: settings.aiTone ?? "",
              senderName: settings.senderName ?? "",
              senderSignature: settings.senderSignature ?? "",
              autonomy: settings.autonomy,
              offerDescription: settings.offerDescription ?? "",
              targetCustomer: settings.targetCustomer ?? "",
              valueProps: settings.valueProps ?? "",
              commonObjections: settings.commonObjections ?? "",
              avgSalesCycleDays: settings.avgSalesCycleDays?.toString() ?? "",
              offerInferredFrom: settings.offerInferredFrom,
            }}
            providers={{
              email: isEmailConfigured(),
              ai: llm ? `${llm.provider} · ${llm.modelId}` : null,
            }}
          />
          <ExtensionTokens
            tokens={tokens.map((token) => ({
              ...token,
              createdAt: token.createdAt.toISOString(),
              lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
