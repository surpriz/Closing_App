import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { ExtensionTokens } from "@/components/dashboard/extension-tokens";
import { PageHeader } from "@/components/dashboard/page-header";
import { PrivacySettings } from "@/components/dashboard/privacy-settings";
import {
  AdvancedSettingsBlock,
  AdvancedSettingsProvider,
  SettingsNav,
} from "@/components/dashboard/settings-advanced";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { TeamSettings } from "@/components/dashboard/team-settings";
import { getLanguageModel } from "@/lib/closing/ai/provider";
import { getSellerPrefs } from "@/lib/closing/notify/preferences";
import { getWorkspaceSettings } from "@/lib/closing/settings";
import { decryptSecret } from "@/lib/crypto";
import { getEnv } from "@/lib/env";
import { extensionProbe } from "@/lib/extension-config";
import { connectedClients } from "@/lib/extension-tokens";
import { prisma } from "@/lib/db";
import { isEmailConfigured } from "@/lib/email";
import { isManagerRole, isOwnerRole } from "@/lib/roles";
import { requireWorkspace } from "@/lib/session";

function safeDecrypt(value: string | null) {
  if (!value) return null;
  try {
    return decryptSecret(value);
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("metaTitle") };
}

// Chrome and Outlook lead: the call alerts depend on them
const ESSENTIAL = [{ id: "extension" }, { id: "pilote" }, { id: "alertes" }, { id: "agenda" }] as const;

const ADVANCED = [
  { id: "offre" },
  { id: "liens" },
  { id: "assistant" },
  { id: "messages" },
  { id: "equipe", managerOnly: true },
  { id: "donnees" },
] as const;

export default async function SettingsPage() {
  const { user, organization, role } = await requireWorkspace();
  const isManager = isManagerRole(role);
  const [settings, tokens, prefs, team] = await Promise.all([
    getWorkspaceSettings(organization.id),
    prisma.extensionToken.findMany({
      where: {
        userId: user.id,
        organizationId: organization.id,
        revokedAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        label: true,
        hint: true,
        createdAt: true,
        lastUsedAt: true,
      },
    }),
    getSellerPrefs(user.id, organization.id),
    isManager ? getTeam(organization.id) : null,
  ]);
  const llm = getLanguageModel("followup");
  const t = await getTranslations("settings.page");

  return (
    <div className="space-y-10">
      <PageHeader
        title={t("title")}
        description={t("description")}
        action={<LocaleSwitcher />}
      />

      <AdvancedSettingsProvider>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[11rem_minmax(0,1fr)]">
          <SettingsNav
            essential={ESSENTIAL.map(({ id }) => ({ id, label: t(`nav.${id}`) }))}
            advanced={ADVANCED.filter(
              (section) => isManager || !("managerOnly" in section),
            ).map(({ id }) => ({ id, label: t(`nav.${id}`) }))}
          />
          <div className="space-y-10">
            {/* Saved on its own, outside the form: it leads because the call alerts depend on it */}
            <div className="max-w-2xl">
              <ExtensionTokens
                tokens={tokens.map((token) => ({
                  ...token,
                  createdAt: token.createdAt.toISOString(),
                  lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
                }))}
                chromeStoreUrl={getEnv().EXTENSION_STORE_URL ?? null}
                probe={extensionProbe(user.email, tokens)}
              />
            </div>
            <SettingsForm
              initial={{
                version: settings.updatedAt.toISOString(),
                alertChannels: settings.alertChannels,
                alertEmail: settings.alertEmail ?? "",
                slackConfigured: !!settings.slackWebhookUrl,
                // Integration secrets stay with the people who can change them
                outboundWebhookUrl: isManager
                  ? (settings.outboundWebhookUrl ?? "")
                  : "",
                webhookSecret: isManager
                  ? safeDecrypt(settings.webhookSecret)
                  : null,
                aiTone: settings.aiTone ?? "",
                senderName: settings.senderName ?? "",
                senderSignature: settings.senderSignature ?? "",
                autonomy: settings.autonomy,
                chatEnabledByDefault: settings.chatEnabledByDefault,
                voiceCommentsByDefault: settings.voiceCommentsByDefault,
                followupsByDefault: settings.followupsByDefault,
                quoteExpiryDays: settings.quoteExpiryDays,
                assistantKnowledge: settings.assistantKnowledge ?? "",
                offerDescription: settings.offerDescription ?? "",
                targetCustomer: settings.targetCustomer ?? "",
                valueProps: settings.valueProps ?? "",
                commonObjections: settings.commonObjections ?? "",
                avgSalesCycleDays: settings.avgSalesCycleDays?.toString() ?? "",
                offerInferredFrom: settings.offerInferredFrom,
              }}
              notifications={{
                emailActions: prefs.emailActions,
                emailCallMoments: prefs.emailCallMoments,
                extensionCallMoments: prefs.extensionCallMoments,
                morningDigest: prefs.morningDigest,
                digestHour: prefs.digestHour,
                extensionConnected: connectedClients(tokens),
                bookingUrl: prefs.bookingUrl ?? "",
              }}
              providers={{
                email: isEmailConfigured(),
                ai: llm ? `${llm.provider} · ${llm.modelId}` : null,
              }}
              canEditWorkspace={isManager}
            />
            <AdvancedSettingsBlock className="space-y-10">
              {/* Unlike the form above, no "Enregistrer": said once, where the rule changes */}
              <p className="text-small text-muted-foreground">{t("instantSave")}</p>
              {team && (
                <TeamSettings
                  viewer={{ userId: user.id, isOwner: isOwnerRole(role) }}
                  members={team.members}
                  invitations={team.invitations}
                />
              )}
              <PrivacySettings
                workspaceName={organization.name}
                isManager={isManager}
                isOwner={isOwnerRole(role)}
              />
            </AdvancedSettingsBlock>
          </div>
        </div>
      </AdvancedSettingsProvider>
    </div>
  );
}

async function getTeam(organizationId: string) {
  const [members, invitations] = await Promise.all([
    prisma.member.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        userId: true,
        role: true,
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.invitation.findMany({
      where: {
        organizationId,
        status: "pending",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, expiresAt: true },
    }),
  ]);
  return {
    members: members.map(({ user, ...member }) => ({
      ...member,
      name: user.name || user.email,
      email: user.email,
    })),
    invitations: invitations.map((invitation) => ({
      ...invitation,
      role: invitation.role ?? "member",
      expiresAt: invitation.expiresAt.toISOString(),
    })),
  };
}
