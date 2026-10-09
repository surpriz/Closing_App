import type { Metadata } from "next";

import { ExtensionTokens } from "@/components/dashboard/extension-tokens";
import { PageHeader } from "@/components/dashboard/page-header";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { TeamSettings } from "@/components/dashboard/team-settings";
import { getLanguageModel } from "@/lib/closing/ai/provider";
import { getSellerPrefs } from "@/lib/closing/notify/preferences";
import { getWorkspaceSettings } from "@/lib/closing/settings";
import { decryptSecret } from "@/lib/crypto";
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

export const metadata: Metadata = { title: "Réglages" };

const SECTIONS = [
  { id: "pilote", label: "Pilote automatique" },
  { id: "offre", label: "Votre offre" },
  { id: "assistant", label: "Assistant prospect" },
  { id: "messages", label: "Vos messages" },
  { id: "alertes", label: "Être prévenu" },
  { id: "extension", label: "Chrome et Outlook" },
  { id: "equipe", label: "Équipe", managerOnly: true },
];

export default async function SettingsPage() {
  const { user, organization, role } = await requireWorkspace();
  const isManager = isManagerRole(role);
  const [settings, tokens, prefs, team] = await Promise.all([
    getWorkspaceSettings(organization.id),
    prisma.extensionToken.findMany({
      where: { userId: user.id, organizationId: organization.id, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, label: true, hint: true, createdAt: true, lastUsedAt: true },
    }),
    getSellerPrefs(user.id, organization.id),
    isManager ? getTeam(organization.id) : null,
  ]);
  const llm = getLanguageModel("followup");

  return (
    <div className="space-y-10">
      <PageHeader title="Réglages" description={`Le pilote automatique de l'espace ${organization.name}.`} />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[11rem_minmax(0,1fr)]">
        <nav aria-label="Sections des réglages" className="hidden lg:block">
          <ul className="sticky top-24 space-y-0.5 text-sm">
            {SECTIONS.filter((section) => isManager || !section.managerOnly).map((section) => (
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
              // Integration secrets stay with the people who can change them
              outboundWebhookUrl: isManager ? (settings.outboundWebhookUrl ?? "") : "",
              webhookSecret: isManager ? safeDecrypt(settings.webhookSecret) : null,
              aiTone: settings.aiTone ?? "",
              senderName: settings.senderName ?? "",
              senderSignature: settings.senderSignature ?? "",
              autonomy: settings.autonomy,
              chatEnabledByDefault: settings.chatEnabledByDefault,
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
              extensionConnected: tokens.length > 0,
            }}
            providers={{
              email: isEmailConfigured(),
              ai: llm ? `${llm.provider} · ${llm.modelId}` : null,
            }}
            canEditWorkspace={isManager}
          />
          <ExtensionTokens
            tokens={tokens.map((token) => ({
              ...token,
              createdAt: token.createdAt.toISOString(),
              lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
            }))}
          />
          {team && (
            <TeamSettings
              viewer={{ userId: user.id, isOwner: isOwnerRole(role) }}
              members={team.members}
              invitations={team.invitations}
            />
          )}
        </div>
      </div>
    </div>
  );
}

async function getTeam(organizationId: string) {
  const [members, invitations] = await Promise.all([
    prisma.member.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      select: { id: true, userId: true, role: true, user: { select: { name: true, email: true } } },
    }),
    prisma.invitation.findMany({
      where: { organizationId, status: "pending", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, expiresAt: true },
    }),
  ]);
  return {
    members: members.map(({ user, ...member }) => ({ ...member, name: user.name || user.email, email: user.email })),
    invitations: invitations.map((invitation) => ({
      ...invitation,
      role: invitation.role ?? "member",
      expiresAt: invitation.expiresAt.toISOString(),
    })),
  };
}
