import type { Metadata } from "next";

import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { inBackground } from "@/lib/closing/background";
import { PageHeader, SectionTitle, Surface } from "@/components/dashboard/page-header";
import { PROVIDER_LABELS } from "@/components/dashboard/prospecting/labels";
import { ProviderCompare } from "@/components/dashboard/prospecting/provider-compare";
import { RunControls } from "@/components/dashboard/prospecting/run-controls";
import { SuggestionsList } from "@/components/dashboard/prospecting/suggestions-list";
import { TargetForm } from "@/components/dashboard/prospecting/target-form";
import { prisma } from "@/lib/db";
import { formatRelative } from "@/lib/format";
import { availableProviders } from "@/lib/prospecting/credentials";
import { requireProspecting } from "@/lib/prospecting/flag";
import { providerMetrics } from "@/lib/prospecting/metrics";
import { pollPendingReveals } from "@/lib/prospecting/reveal";
import { expireStaleRuns } from "@/lib/prospecting/search";
import { describeTarget, EMPTY_TARGET, targetIsSearchable } from "@/lib/prospecting/target";
import { activeTarget, filtersOf } from "@/lib/prospecting/targets";

export const metadata: Metadata = { title: "Prospection" };
// The page's actions write a message with the AI and start searches in the background
export const maxDuration = 300;

const DEFAULT_SENIORITIES = ["owner", "founder", "c_suite", "director"];
const PAGE_POLL_SPACING_MS = 5_000;

export default async function ProspectionPage() {
  const { organization } = await requireProspecting();
  const now = new Date();

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
      select: { id: true, name: true },
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
        title="Prospection"
        description="Des décideurs qui ressemblent à vos clients. Vous choisissez qui révéler."
      />

      <section>
        <SectionTitle hint={target ? describeTarget(filters) || undefined : "à définir"}>Votre cible</SectionTitle>
        <Surface className="p-5 sm:p-6">
          <TargetForm key={target?.id ?? "new"} initial={filters} origin={target?.origin ?? null} />
        </Surface>
      </section>

      <section className="space-y-4">
        <SectionTitle>Recherche</SectionTitle>
        <RunControls
          providers={availableProviders(organization.id)}
          disabled={!target || !targetIsSearchable(filters) || running}
        />
        {runs.length > 0 && (
          <ul className="space-y-1 text-small text-muted-foreground">
            {runs.map((run) => (
              <li key={run.id}>
                {PROVIDER_LABELS[run.provider]} · {formatRelative(run.startedAt, now)} ·{" "}
                {run.status === "RUNNING"
                  ? "en cours…"
                  : run.status === "FAILED"
                    ? `échec : ${run.error ?? "erreur inconnue"}`
                    : `${run.created} nouvelle${run.created > 1 ? "s" : ""} suggestion${run.created > 1 ? "s" : ""} sur ${run.found} trouvée${run.found > 1 ? "s" : ""}${run.error ? ` (${run.error})` : ""}`}
              </li>
            ))}
          </ul>
        )}
      </section>

      {metrics.length > 0 && (
        <section>
          <SectionTitle hint="sur votre cible actuelle">Fournisseurs</SectionTitle>
          <Surface>
            <ProviderCompare metrics={metrics} />
          </Surface>
        </section>
      )}

      <section>
        <SectionTitle hint={rows.length ? String(rows.length) : undefined}>Suggestions</SectionTitle>
        {rows.length ? (
          <Surface>
            <SuggestionsList rows={rows} documents={documents} />
          </Surface>
        ) : (
          <p className="text-small text-muted-foreground">Lancez une recherche pour voir des contacts.</p>
        )}
      </section>
    </div>
  );
}
