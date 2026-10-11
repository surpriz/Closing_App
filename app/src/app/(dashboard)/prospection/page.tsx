import type { Metadata } from "next";

import { PageHeader, SectionTitle, Surface } from "@/components/dashboard/page-header";
import { TargetForm } from "@/components/dashboard/prospecting/target-form";
import { requireProspecting } from "@/lib/prospecting/flag";
import { describeTarget, EMPTY_TARGET } from "@/lib/prospecting/target";
import { activeTarget, filtersOf } from "@/lib/prospecting/targets";

export const metadata: Metadata = { title: "Prospection" };

export default async function ProspectionPage() {
  const { organization } = await requireProspecting();
  const target = await activeTarget(organization.id);
  const filters = target ? filtersOf(target) : { ...EMPTY_TARGET, seniorities: ["owner", "founder", "c_suite", "director"] };

  return (
    <div className="space-y-10">
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
    </div>
  );
}
