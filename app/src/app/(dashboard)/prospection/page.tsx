import { Telescope } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { requireProspecting } from "@/lib/prospecting/flag";

export const metadata: Metadata = { title: "Prospection" };

export default async function ProspectionPage() {
  await requireProspecting();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Prospection"
        description="Des décideurs qui ressemblent à vos clients. Vous choisissez qui révéler."
      />
      <EmptyState
        icon={Telescope}
        title="Définissez votre cible"
        description="Saisissez-la ou laissez Clozer la déduire de vos devis et présentations."
      />
    </div>
  );
}
