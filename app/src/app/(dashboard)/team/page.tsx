import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  PageHeader,
  SectionTitle,
} from "@/components/dashboard/page-header";
import { DealColumn } from "@/components/dashboard/team/deal-column";
import { formatMoney, sumMoney } from "@/components/dashboard/team/money";
import { SellerTable } from "@/components/dashboard/team/seller-table";
import { buttonVariants } from "@/components/ui/button";
import { BILLING_HREF } from "@/lib/billing/plans";
import { planFor } from "@/lib/billing/workspace-plan";
import { compareDeals } from "@/lib/closing/dashboard/rank";
import {
  getTeamBoard,
  type TeamDealRow,
} from "@/lib/closing/dashboard/team-queries";
import { requireManager } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("team");
  return { title: t("metaTitle") };
}

const COLUMN_LIMIT = 15;
const REFRESH_MS = 60_000;

// Dead deals by what they were worth: the ones to chase or close first
const byAmount = (a: TeamDealRow, b: TeamDealRow) =>
  (b.amountCents ?? -1) - (a.amountCents ?? -1) || compareDeals(a, b);

export default async function TeamPage(props: PageProps<"/team">) {
  const { organization } = await requireManager("/team");
  const [t, tl, locale] = await Promise.all([
    getTranslations("team.page"),
    getTranslations("labels"),
    getLocale(),
  ]);
  // Below Team: what the view would show, and where to get it. Nothing is computed
  if (!planFor(organization).limits.teamView) {
    const tb = await getTranslations("billing");
    return (
      <div className="space-y-8">
        <PageHeader title={t("title")} description={t("descriptionTeam")} />
        <EmptyState
          title={tb("upgrade.title")}
          description={tb("upgrade.reason.team")}
          action={
            <Link href={BILLING_HREF} className={buttonVariants()}>
              {tb("upgrade.cta")}
            </Link>
          }
        />
      </div>
    );
  }

  const now = new Date();
  const board = await getTeamBoard(organization.id, now);

  const names = new Map(
    board.sellers.map((seller) => [seller.id, seller.name]),
  );
  const param = (await props.searchParams).seller;
  const selected = typeof param === "string" && names.has(param) ? param : null;
  const rows = selected
    ? board.rows.filter((row) => row.sellerId === selected)
    : board.rows;
  const summaries = selected
    ? board.summaries.filter((s) => s.sellerId === selected)
    : board.summaries;

  const hot = rows.filter((row) => row.health === "hot").sort(compareDeals);
  const atRisk = rows
    .filter((row) => row.health === "at_risk")
    .sort(compareDeals);
  const dead = rows.filter((row) => row.health === "dead").sort(byAmount);
  const pipeline = formatMoney(
    sumMoney(summaries.map((s) => s.pipeline)),
    locale,
  );
  const deadAmount = formatMoney(
    sumMoney(summaries.map((s) => s.deadAmount)),
    locale,
  );
  // The seller is in the page title: no need to repeat it on every deal
  const dealNames = selected || board.sellers.length < 2 ? null : names;

  return (
    <div className="space-y-10">
      <AutoRefresh intervalMs={REFRESH_MS} />
      <PageHeader
        title={selected ? names.get(selected) : t("title")}
        description={
          selected ? t("descriptionSeller") : t("descriptionTeam")
        }
        action={
          selected ? (
            <Link
              href="/team"
              className={buttonVariants({ variant: "outline" })}
            >
              {t("allTeam")}
            </Link>
          ) : board.sellers.length < 2 ? (
            <Link
              href="/settings#equipe"
              className={buttonVariants({ variant: "outline" })}
            >
              {t("invite")}
            </Link>
          ) : null
        }
      />

      {board.rows.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <>
          {/* The team's report line: fields, not a row of KPI boxes. */}
          <dl className="flex flex-wrap gap-x-8 gap-y-2 border-y border-foreground py-3 text-body">
            <ReportField label={t("open")} value={rows.length} />
            <ReportField
              label={tl("teamHealth.hot")}
              value={hot.length}
              swatch="bg-success"
            />
            <ReportField
              label={tl("teamHealth.at_risk")}
              value={atRisk.length}
              swatch="bg-warning"
            />
            <ReportField
              label={tl("teamHealth.dead")}
              value={
                deadAmount ? `${dead.length} · ${deadAmount}` : dead.length
              }
            />
            <ReportField label={t("pipeline")} value={pipeline ?? "–"} />
          </dl>

          {board.sellers.length > 1 && (
            <section>
              <SectionTitle hint={t("bySellerHint")}>
                {t("bySeller")}
              </SectionTitle>
              <SellerTable
                summaries={summaries}
                names={names}
                selected={selected}
              />
            </section>
          )}

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <DealColumn
              title={tl("teamHealth.hot")}
              hint={tl("teamHealthHint.hot")}
              empty={t("emptyHot")}
              rows={hot}
              names={dealNames}
              now={now}
              limit={COLUMN_LIMIT}
            />
            <DealColumn
              title={tl("teamHealth.at_risk")}
              hint={tl("teamHealthHint.at_risk")}
              empty={t("emptyAtRisk")}
              rows={atRisk}
              names={dealNames}
              now={now}
              limit={COLUMN_LIMIT}
            />
            <DealColumn
              title={tl("teamHealth.dead")}
              hint={tl("teamHealthHint.dead")}
              empty={t("emptyDead")}
              rows={dead}
              names={dealNames}
              now={now}
              limit={COLUMN_LIMIT}
            />
          </div>

          {board.capped && (
            <p className="text-small text-muted-foreground">
              {t("capped")}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function ReportField({
  label,
  value,
  swatch,
}: {
  label: string;
  value: React.ReactNode;
  swatch?: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="flex items-center gap-1.5 text-small text-muted-foreground">
        {swatch && <span aria-hidden className={`size-2 ${swatch}`} />}
        {label}
      </dt>
      <dd className="font-mono font-medium">{value}</dd>
    </div>
  );
}
