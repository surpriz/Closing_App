import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader, SectionTitle, Stat } from "@/components/dashboard/page-header";
import { OutcomeTable } from "@/components/dashboard/results/outcome-table";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getResults, RESULTS_DEAL_DAYS, RESULTS_FOLLOWUP_DAYS } from "@/lib/closing/results/queries";
import type { DealProfile } from "@/lib/closing/results/stats";
import { prisma } from "@/lib/db";
import { formatDuration } from "@/lib/format";
import { isManagerRole } from "@/lib/roles";
import { requireWorkspace } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("results");
  return { title: t("metaTitle") };
}

/**
 * What works: which follow-ups get answers, at what hour, and what won deals did that lost ones
 * did not. A seller sees their own deals; a manager the whole team, or their own.
 */
export default async function ResultsPage(props: PageProps<"/results">) {
  const workspace = await requireWorkspace("/results");
  const manager = isManagerRole(workspace.role);
  const mine = !manager || (await props.searchParams).scope === "mine";
  const [t, tl] = await Promise.all([getTranslations("results"), getTranslations("labels")]);
  const results = await getResults(workspace.organization.id, mine ? workspace.scope : null);

  const members = manager && !mine
    ? await prisma.member.findMany({
        where: { organizationId: workspace.organization.id },
        select: { userId: true, user: { select: { name: true, email: true } } },
      })
    : [];
  const names = new Map(members.map((m) => [m.userId, m.user.name || m.user.email]));
  const label = (key: string, prefix: "followupTrigger" | "followupGoal") =>
    tl.has(`${prefix}.${key}` as never) ? tl(`${prefix}.${key}` as never) : key;

  const scopeSwitch = manager && (
    <div className="flex gap-1.5">
      <Link href="/results" className={buttonVariants({ size: "sm", variant: mine ? "outline" : "default" })}>
        {t("scopeTeam")}
      </Link>
      <Link href="/results?scope=mine" className={buttonVariants({ size: "sm", variant: mine ? "default" : "outline" })}>
        {t("scopeMine")}
      </Link>
    </div>
  );

  const empty = results.sent === 0 && results.won.count + results.lost.count === 0;
  if (empty) {
    return (
      <div className="space-y-10">
        <PageHeader title={t("title")} description={t("description")} action={scopeSwitch} />
        <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <PageHeader title={t("title")} description={t("description")} action={scopeSwitch} />

      <section>
        <SectionTitle hint={t("followupsHint", { days: RESULTS_FOLLOWUP_DAYS })}>{t("byTrigger")}</SectionTitle>
        {results.sent > 0 ? (
          <OutcomeTable
            label={t("table.kind")}
            groups={results.byTrigger.map((g) => ({ ...g, label: label(g.key, "followupTrigger") }))}
          />
        ) : (
          <p className="text-small text-muted-foreground">{t("noFollowups")}</p>
        )}
      </section>

      {results.byGoal.length > 0 && (
        <section>
          <SectionTitle hint={t("byGoalHint")}>{t("byGoal")}</SectionTitle>
          <OutcomeTable
            label={t("table.goal")}
            groups={results.byGoal.map((g) => ({ ...g, label: label(g.key, "followupGoal") }))}
          />
        </section>
      )}

      {results.byHour.length > 0 && (
        <section>
          <SectionTitle hint={t("byHourHint")}>{t("byHour")}</SectionTitle>
          <OutcomeTable label={t("table.hour")} groups={results.byHour.map((g) => ({ ...g, label: `${g.key} h` }))} />
        </section>
      )}

      <section className="space-y-4">
        <SectionTitle hint={t("dealsHint", { days: RESULTS_DEAL_DAYS })}>{t("wonVsLost")}</SectionTitle>
        <div className="grid gap-8 sm:grid-cols-2">
          <ProfileColumn title={t("won", { count: results.won.count })} profile={results.won} t={t} />
          <ProfileColumn title={t("lost", { count: results.lost.count })} profile={results.lost} t={t} />
        </div>
        {results.lostReasons.length > 0 && (
          <p className="text-small text-muted-foreground">
            {t("lostReasons")}{" "}
            {results.lostReasons
              .map((r) => `${r.reason === "UNKNOWN" ? t("reasonUnknown") : tl(`closeReason.${r.reason}` as never)} (${r.count})`)
              .join(" · ")}
          </p>
        )}
      </section>

      {results.reactions.length > 0 && (
        <section>
          <SectionTitle hint={t("reactionHint")}>{t("reaction")}</SectionTitle>
          <div className="border-b border-foreground bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">{t("seller")}</TableHead>
                  <TableHead className="text-right">{t("alerts")}</TableHead>
                  <TableHead className="text-right">{t("median")}</TableHead>
                  <TableHead className="text-right">{t("withinHour")}</TableHead>
                  <TableHead className="pr-4 text-right">{t("missed")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.reactions.map((r) => (
                  <TableRow key={r.userId}>
                    <TableCell className="pl-4">{names.get(r.userId) ?? (mine ? t("you") : t("formerMember"))}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.alerts}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.medianMs === null ? "–" : formatDuration(r.medianMs)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{Math.round(r.withinHour * 100)} %</TableCell>
                    <TableCell className="pr-4 text-right tabular-nums">{r.missed}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}

function ProfileColumn({
  title,
  profile,
  t,
}: {
  title: string;
  profile: DealProfile;
  t: Awaited<ReturnType<typeof getTranslations<"results">>>;
}) {
  const none = "–";
  return (
    <div className="space-y-4">
      <p className="text-body font-semibold">{title}</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        <Stat label={t("readingTime")} value={profile.readingMs === null ? none : formatDuration(profile.readingMs)} />
        <Stat label={t("visits")} value={profile.visits ?? none} />
        <Stat label={t("readers")} value={profile.readers ?? none} />
        <Stat label={t("pricingRead")} value={profile.pricingShare === null ? none : `${Math.round(profile.pricingShare * 100)} %`} />
        <Stat
          label={t("daysToClose")}
          value={profile.daysToClose === null ? none : t("days", { count: Math.round(profile.daysToClose) })}
        />
      </div>
    </div>
  );
}
