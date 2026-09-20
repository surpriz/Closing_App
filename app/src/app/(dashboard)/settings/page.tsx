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

export default async function SettingsPage() {
  const { organization } = await requireWorkspace();
  const settings = await getWorkspaceSettings(organization.id);
  const llm = getLanguageModel("followup");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
        <p className="text-sm text-muted-foreground">
          Règles par défaut des relances et des alertes pour {organization.name}.
        </p>
      </div>

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
        }}
        providers={{
          email: isEmailConfigured(),
          whatsapp: isWhatsAppConfigured(),
          ai: llm ? `${llm.provider} · ${llm.modelId}` : null,
          cron: !!process.env.CRON_SECRET,
        }}
      />
    </div>
  );
}
