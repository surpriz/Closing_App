import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { inBackground } from "@/lib/closing/background";
import { PageHeader, SectionTitle, Surface } from "@/components/dashboard/page-header";
import { providerLabel } from "@/components/dashboard/prospecting/labels";
import { ProviderCompare } from "@/components/dashboard/prospecting/provider-compare";
import { RunControls } from "@/components/dashboard/prospecting/run-controls";
import { SuggestionsList } from "@/components/dashboard/prospecting/suggestions-list";
import { TargetForm } from "@/components/dashboard/prospecting/target-form";
import { prisma } from "@/lib/db";
import { formatRelative } from "@/lib/format";
import { availableProviders } from "@/lib/prospecting/credentials";
import { regionName } from "@/lib/prospecting/geo";
import { headcountRanges } from "@/lib/prospecting/headcount";
import { requireProspecting } from "@/lib/prospecting/flag";
import { providerMetrics } from "@/lib/prospecting/metrics";
import { nafLabel } from "@/lib/prospecting/naf";
import { pollPendingReveals } from "@/lib/prospecting/reveal";
import { expireStaleRuns } from "@/lib/prospecting/search";
import { EMPTY_TARGET, targetIsSearchable, type TargetFilters } from "@/lib/prospecting/target";
import { activeTarget, filtersOf } from "@/lib/prospecting/targets";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("prospecting");
  return { title: t("metaTitle") };
}
// The page's actions write a message with the AI and start searches in the background
export const maxDuration = 300;

const DEFAULT_SENIORITIES = ["owner", "founder", "c_suite", "director"];
const PAGE_POLL_SPACING_MS = 5_000;

type PageT = Awaited<ReturnType<typeof getTranslations<"prospecting">>>;

/** describeTarget with translated UI words; NAF and region names stay French data. */
function describeTargetIn(t: PageT, target: TargetFilters) {
  const sectors = target.keywords.length
    ? target.keywords
    : [...new Set(target.nafCodes.map((code) => nafLabel(code) ?? code))];
  const sizes = headcountRanges(target.headcountCodes).map((range) =>
    range.max === null
      ? t("targetForm.headcountOpen", { min: range.min })
      : t("targetForm.headcountRange", { min: range.min, max: range.max }),
  );
  const places = [
    ...target.regions.map((code) => regionName(code) ?? code),
    ...target.departements.map((code) => t("page.departement", { code })),
  ];
  return [sectors.join(", "), sizes.join(", "), places.join(", ")].filter(Boolean).join(" · ");
}

export default async function ProspectionPage() {
  const { organization } = await requireProspecting();
  const now = new Date();
  const [t, tl, locale] = await Promise.all([
    getTranslations("prospecting"),
    getTranslations("prospecting.labels"),
    getLocale(),
  ]);

  const [target, runs, suggestions, documents] = await Promise.all([
    activeTarget(organization.id),
    prisma.prospectingRun.findMany({
      where: { organizationId: organization.id },
      orderBy: { startedAt: "desc" },
      take: 5,
    }),
    prisma.prospectSuggestion.findMany({
      where: { organizationId: organization.id, status: { not: "REJECTED" } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        provider: true,
        firstName: true,
        lastNameMasked: true,
        lastName: true,
        title: true,
        companyName: true,
        nafVerified: true,
        linkedinUrl: true,
        status: true,
        invalidReason: true,
        email: true,
        linkId: true,
        updatedAt: true,
      },
    }),
    prisma.document.findMany({
      where: { organizationId: organization.id, archivedAt: null, status: "READY" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, name: true, displayTitle: true, docType: true },
    }),
  ]);

  // Every run on the active target, rejected suggestions included: the providers are judged on all they gave
  const compared = target
    ? await prisma.prospectSuggestion.findMany({
        where: { organizationId: organization.id, run: { targetProfileId: target.id } },
        select: { id: true, provider: true, seniority: true, nafVerified: true, status: true, invalidReason: true },
        orderBy: { createdAt: "desc" },
        take: 2000,
      })
    : [];
  const credits = compared.length
    ? await prisma.prospectingCreditEntry.findMany({
        where: { organizationId: organization.id, suggestionId: { in: compared.map((s) => s.id) } },
        select: { provider: true, kind: true, credits: true },
      })
    : [];
  const metrics = providerMetrics(compared, credits);

  const filters = target ? filtersOf(target) : { ...EMPTY_TARGET, seniorities: DEFAULT_SENIORITIES };
  const running = runs.some((run) => run.status === "RUNNING");
  const revealing = suggestions.some((s) => s.status === "REVEALING" || s.status === "ACCEPTED");
  // The cron is not guaranteed: the page itself follows reveals in flight while it is open,
  // at most every few seconds whatever the number of open tabs (each row is claimed anyway)
  const due = suggestions.some(
    (s) => s.status === "REVEALING" && now.getTime() - s.updatedAt.getTime() > PAGE_POLL_SPACING_MS,
  );
  if (due || running) {
    inBackground("prospecting-poll", async () => {
      await expireStaleRuns(now, { organizationId: organization.id });
      await pollPendingReveals(now, { organizationId: organization.id });
    });
  }
  // Who the person is stays hidden until the reveal: a LinkedIn slug often holds the full name
  const rows = suggestions.map((s) => ({
    ...s,
    lastName: s.status === "READY" ? s.lastName : null,
    linkedinUrl: s.status === "READY" ? s.linkedinUrl : null,
  }));

  return (
    <div className="space-y-10">
      {(running || revealing) && <AutoRefresh intervalMs={4000} />}
      <PageHeader
        title={t("page.title")}
        description={
          <>
            {t("page.description")}
            <span className="block text-small">{t("page.coverage")}</span>
          </>
        }
      />

      <section>
        <SectionTitle hint={target ? describeTargetIn(t, filters) || undefined : t("page.targetUndefined")}>
          {t("page.target")}
        </SectionTitle>
        <Surface className="p-5 sm:p-6">
          <TargetForm key={target?.id ?? "new"} initial={filters} origin={target?.origin ?? null} />
        </Surface>
      </section>

      <section className="space-y-4">
        <SectionTitle>{t("page.search")}</SectionTitle>
        <RunControls
          providers={availableProviders(organization.id)}
          disabled={!target || !targetIsSearchable(filters) || running}
        />
        {runs.length > 0 && (
          <ul className="space-y-1 text-small text-muted-foreground">
            {runs.map((run) => (
              <li key={run.id}>
                {providerLabel(tl, run.provider)} · {formatRelative(run.startedAt, locale, now)} ·{" "}
                {run.status === "RUNNING"
                  ? t("page.runRunning")
                  : run.status === "FAILED"
                    ? t("page.runFailed", { error: run.error ?? t("page.unknownError") })
                    : `${t("page.runDone", { created: run.created, found: run.found })}${run.error ? ` (${run.error})` : ""}`}
              </li>
            ))}
          </ul>
        )}
      </section>

      {metrics.length > 0 && (
        <section>
          <SectionTitle hint={t("page.providersHint")}>{t("page.providers")}</SectionTitle>
          <Surface>
            <ProviderCompare metrics={metrics} />
          </Surface>
        </section>
      )}

      <section>
        <SectionTitle hint={rows.length ? String(rows.length) : undefined}>{t("page.suggestions")}</SectionTitle>
        {rows.length ? (
          <Surface>
            <SuggestionsList rows={rows} documents={documents} />
          </Surface>
        ) : (
          <p className="text-small text-muted-foreground">{t("page.empty")}</p>
        )}
      </section>
    </div>
  );
}
