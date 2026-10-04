import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { getLanguageModel } from "@/lib/closing/ai/provider";
import { isWhatsAppConfigured } from "@/lib/closing/channels/whatsapp";
import { getWorkspaceSettings } from "@/lib/closing/settings";
import { decryptSecret } from "@/lib/crypto";
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

export default async function SettingsPage() {
  const { organization } = await requireWorkspace();
  const settings = await getWorkspaceSettings(organization.id);
  const llm = getLanguageModel("followup");

  return (
    <div className="space-y-10">
      <PageHeader title="Réglages" description={`Relances et alertes de l'espace ${organization.name}.`} />

      <SettingsForm
        initial={{
          version: settings.updatedAt.toISOString(),
          defaultChannels: settings.defaultChannels,
          hotPricingThresholdSec: settings.hotPricingThresholdSec,
          inactivityDays: settings.inactivityDays.join(", "),
          businessHourStart: settings.businessHourStart,
          businessHourEnd: settings.businessHourEnd,
          multiViewerThreshold: settings.multiViewerThreshold,
          reopenAfterInactivityDays: settings.reopenAfterInactivityDays,
          alertChannels: settings.alertChannels,
          alertEmail: settings.alertEmail ?? "",
          slackConfigured: !!settings.slackWebhookUrl,
          outboundWebhookUrl: settings.outboundWebhookUrl ?? "",
          webhookSecret: safeDecrypt(settings.webhookSecret),
          aiTone: settings.aiTone ?? "",
          senderName: settings.senderName ?? "",
          senderSignature: settings.senderSignature ?? "",
          autonomy: settings.autonomy,
          autopilotMinConfidence: settings.autopilotMinConfidence,
          maxFollowupsPer30Days: settings.maxFollowupsPer30Days,
          minDaysBetweenFollowups: settings.minDaysBetweenFollowups,
          minDelayAfterReadingHours: settings.minDelayAfterReadingHours,
          offerDescription: settings.offerDescription ?? "",
          targetCustomer: settings.targetCustomer ?? "",
          valueProps: settings.valueProps ?? "",
          commonObjections: settings.commonObjections ?? "",
          avgSalesCycleDays: settings.avgSalesCycleDays?.toString() ?? "",
        }}
        providers={{
          email: isEmailConfigured(),
          whatsapp: isWhatsAppConfigured(),
          ai: llm ? `${llm.provider} · ${llm.modelId}` : null,
        }}
      />
    </div>
  );
}
