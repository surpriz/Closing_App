import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { BillingSettings } from "@/components/dashboard/billing-settings";
import { ExtensionTokens } from "@/components/dashboard/extension-tokens";
import { MailboxSettings } from "@/components/dashboard/mailbox-settings";
import { PageHeader } from "@/components/dashboard/page-header";
import { PrivacySettings } from "@/components/dashboard/privacy-settings";
import {
  AdvancedSettingsBlock,
  AdvancedSettingsProvider,
  SettingsNav,
} from "@/components/dashboard/settings-advanced";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { SuppressionList } from "@/components/dashboard/suppression-list";
import { TeamSettings } from "@/components/dashboard/team-settings";
import { offerEndsAt } from "@/lib/billing/offers";
import { countAiFollowupsThisMonth, countLinksCreatedThisMonth, countVideoPitches, isBillingEnabled, planFor } from "@/lib/billing/workspace-plan";
import { getLanguageModel } from "@/lib/closing/ai/provider";
import { getSellerPrefs } from "@/lib/closing/notify/preferences";
import { getWorkspaceSettings } from "@/lib/closing/settings";
import { decryptSecret } from "@/lib/crypto";
import { getEnv } from "@/lib/env";
import { extensionProbe } from "@/lib/extension-config";
import { connectedClients } from "@/lib/extension-tokens";
import { prisma } from "@/lib/db";
import { isEmailConfigured } from "@/lib/email";
import { gmailConnector, isMicrosoftMailboxConfigured } from "@/lib/mailboxes/config";
import { dailyAllowance } from "@/lib/mailboxes/caps/allowance";
import { sentToday } from "@/lib/mailboxes/connect";
import type { DnsReport } from "@/lib/mailboxes/dns/checks";
import { isOutreachAllowed } from "@/lib/outreach/flag";
import { countSuppressions, listSuppressions } from "@/lib/outreach/suppression";
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
const ESSENTIAL = [
  { id: "extension" },
  { id: "boite", outreachOnly: true },
  { id: "pilote" },
  { id: "alertes" },
  { id: "agenda" },
  { id: "facturation" },
] as const;

const ADVANCED = [
  { id: "offre" },
  { id: "liens" },
  { id: "assistant" },
  { id: "messages" },
  { id: "equipe", managerOnly: true },
  { id: "donnees" },
] as const;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : null);
  const flag = one(query.mailbox);
  const { user, organization, role } = await requireWorkspace();
  const isManager = isManagerRole(role);
  const billing = planFor(organization);
  const outreach = isOutreachAllowed(user, organization.id);
  const [settings, tokens, prefs, team, usage, mailboxes, stopList] = await Promise.all([
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
    getBillingUsage(organization.id),
    outreach ? getMailboxes(user.id, organization.id) : null,
    outreach ? getStopList(organization.id) : null,
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
            essential={ESSENTIAL.filter((section) => outreach || !("outreachOnly" in section)).map(({ id }) => ({
              id,
              label: t(`nav.${id}`),
            }))}
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
            {mailboxes && (
              <div className="max-w-2xl">
                <MailboxSettings
                  mailboxes={mailboxes}
                  maxCap={getEnv().MAILBOX_DAILY_CAP_MAX}
                  availability={{ google: gmailConnector(), microsoft: isMicrosoftMailboxConfigured() }}
                  flash={flag ? { flag, code: one(query.code) } : null}
                />
              </div>
            )}
            {stopList && (
              <div className="max-w-2xl">
                <SuppressionList
                  rows={stopList.rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))}
                  total={stopList.total}
                />
              </div>
            )}
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
            <BillingSettings
              plan={billing.plan}
              source={billing.source}
              endsAt={billing.endsAt?.toISOString() ?? null}
              paymentIssue={billing.paymentIssue}
              subscribed={billing.subscribed}
              periodEnd={organization.currentPeriodEnd?.toISOString() ?? null}
              interval={organization.billingInterval === "month" || organization.billingInterval === "year" ? organization.billingInterval : null}
              seats={organization.seats}
              members={usage.members}
              usage={{
                links: { used: usage.links, max: billing.limits.linksPerMonth },
                aiFollowups: { used: usage.aiFollowups, max: billing.limits.aiFollowupsPerMonth },
                videoPitches: { used: usage.videoPitches, max: billing.limits.videoPitches },
              }}
              canManage={isManager}
              billingEnabled={isBillingEnabled()}
              hasCustomer={!!organization.stripeCustomerId}
              offerEndsAt={billing.subscribed === null ? (offerEndsAt(organization, new Date())?.toISOString() ?? null) : null}
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

async function getStopList(organizationId: string) {
  const [rows, total] = await Promise.all([listSuppressions(organizationId), countSuppressions(organizationId)]);
  return { rows, total };
}

async function getMailboxes(userId: string, organizationId: string) {
  const now = new Date();
  const maxCap = getEnv().MAILBOX_DAILY_CAP_MAX;
  const rows = await prisma.mailbox.findMany({
    where: { userId, organizationId, status: { not: "DISCONNECTED" } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      status: true,
      lastError: true,
      dailyCap: true,
      rampStartedAt: true,
      timezone: true,
      sentDay: true,
      sentCount: true,
      dnsDetail: true,
      provider: true,
      connector: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    status: row.status,
    lastError: row.lastError,
    dailyCap: row.dailyCap,
    allowance: dailyAllowance(row, now, { max: maxCap }),
    sentToday: sentToday(row, now),
    dns: (row.dnsDetail as DnsReport | null) ?? null,
    provider: row.provider,
    connector: row.connector,
  }));
}

async function getBillingUsage(organizationId: string) {
  const [links, aiFollowups, videoPitches, members] = await Promise.all([
    countLinksCreatedThisMonth(organizationId),
    countAiFollowupsThisMonth(organizationId),
    countVideoPitches(organizationId),
    prisma.member.count({ where: { organizationId } }),
  ]);
  return { links, aiFollowups, videoPitches, members };
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
