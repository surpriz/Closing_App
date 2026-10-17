import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AskHelpButton, FaqList } from "@/components/dashboard/faq-list";
import { PageHeader } from "@/components/dashboard/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help.faq");
  return { title: t("metaTitle") };
}

export default async function FaqPage() {
  const t = await getTranslations("help.faq");
  return (
    <div className="max-w-3xl space-y-10">
      <PageHeader
        title={t("title")}
        description={t("description")}
        action={<AskHelpButton />}
      />
      <FaqList />
    </div>
  );
}
