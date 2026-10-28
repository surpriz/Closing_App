import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { CampaignList } from "@/components/dashboard/campaigns/campaign-list";
import { MailboxBanner } from "@/components/dashboard/campaigns/mailbox-banner";
import { NewCampaignDialog } from "@/components/dashboard/campaigns/new-campaign-dialog";
import { PageHeader, Surface } from "@/components/dashboard/page-header";
import type { UiLocale } from "@/i18n/locale";
import { inBackground } from "@/lib/closing/background";
import { prisma } from "@/lib/db";
import { requireOutreach } from "@/lib/outreach/flag";
import { runOutreachTick } from "@/lib/outreach/tick";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("campaigns");
  return { title: t("metaTitle") };
}
export const maxDuration = 300;

const REFRESH_MS = 30_000;

export default async function CampaignsPage() {
  const { user, organization } = await requireOutreach();
  const now = new Date();
  const [t, locale] = await Promise.all([getTranslations("campaigns"), getLocale()]);

  // Opening the page catches up on what the engine has not run yet (replies, due sends)
  inBackground("outreach-catch-up", () =>
    runOutreachTick(now, { organizationId: organization.id, syncBudgetMs: 15_000 }),
  );

  const [campaigns, mailboxes] = await Promise.all([
    prisma.campaign.findMany({
      where: { organizationId: organization.id, status: { not: "ARCHIVED" } },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        status: true,
        updatedAt: true,
        mailbox: { select: { email: true } },
      },
    }),
    prisma.mailbox.findMany({
      where: { organizationId: organization.id, status: { in: ["ACTIVE", "ERROR"] } },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, status: true, lastError: true, userId: true },
    }),
  ]);

  // Two grouped queries for the whole page, not one per campaign
  const ids = campaigns.map((campaign) => campaign.id);
  const [enrollmentGroups, sentGroups] = ids.length
    ? await Promise.all([
        prisma.campaignProspect.groupBy({
          by: ["campaignId", "status"],
          where: { campaignId: { in: ids } },
          _count: { _all: true },
        }),
        prisma.campaignMessage.groupBy({
          by: ["campaignId"],
          where: { campaignId: { in: ids }, status: "SENT" },
          _count: { _all: true },
        }),
      ])
    : [[], []];

  const counts = new Map<string, { enrolled: number; replied: number; bounced: number }>();
  for (const group of enrollmentGroups) {
    const entry = counts.get(group.campaignId) ?? { enrolled: 0, replied: 0, bounced: 0 };
    entry.enrolled += group._count._all;
    if (group.status === "REPLIED") entry.replied += group._count._all;
    if (group.status === "BOUNCED") entry.bounced += group._count._all;
    counts.set(group.campaignId, entry);
  }
  const sent = new Map(sentGroups.map((group) => [group.campaignId, group._count._all]));

  const rows = campaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    mailbox: campaign.mailbox?.email ?? null,
    enrolled: counts.get(campaign.id)?.enrolled ?? 0,
    sent: sent.get(campaign.id) ?? 0,
    replied: counts.get(campaign.id)?.replied ?? 0,
    bounced: counts.get(campaign.id)?.bounced ?? 0,
    updatedAt: campaign.updatedAt,
  }));

  const active = mailboxes.filter((mailbox) => mailbox.status === "ACTIVE");
  const failing = mailboxes.filter((mailbox) => mailbox.status === "ERROR");
  const own = active.find((mailbox) => mailbox.userId === user.id);
  const uiLocale = locale as UiLocale;

  return (
    <div className="space-y-8">
      {campaigns.some((campaign) => campaign.status === "ACTIVE") && <AutoRefresh intervalMs={REFRESH_MS} />}
      <PageHeader
        title={t("page.title")}
        description={t("page.description")}
        action={
          <NewCampaignDialog
            mailboxes={active.map(({ id, email }) => ({ id, email }))}
            defaultMailboxId={own?.id ?? null}
            defaultLocale={uiLocale === "fr" ? "fr" : "en"}
          />
        }
      />
      {active.length === 0 && <p className="text-small text-muted-foreground">{t("page.noMailboxHint")}</p>}
      <MailboxBanner mailboxes={failing} hasActive={active.length > 0} />

      {rows.length ? (
        <Surface>
          <CampaignList rows={rows} locale={uiLocale} now={now} />
        </Surface>
      ) : (
        <p className="text-small text-muted-foreground">{t("page.empty")}</p>
      )}
    </div>
  );
}
