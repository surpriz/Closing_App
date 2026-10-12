import type { Metadata } from "next";

import { AskHelpButton, FaqList } from "@/components/dashboard/faq-list";
import { PageHeader } from "@/components/dashboard/page-header";

export const metadata: Metadata = { title: "Questions fréquentes" };

export default function FaqPage() {
  return (
    <div className="max-w-3xl space-y-10">
      <PageHeader
        title="Questions fréquentes"
        description="Tout ce qu'on nous demande sur Clozer : documents, liens, relances, équipe, données. Une question manque ? L'assistant vous répond."
        action={<AskHelpButton />}
      />
      <FaqList />
    </div>
  );
}
