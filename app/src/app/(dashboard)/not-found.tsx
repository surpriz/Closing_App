import Link from "next/link";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/dashboard/empty-state";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  const t = useTranslations("common.notFound");
  return (
    <EmptyState
      title={t("title")}
      description={t("description")}
      action={
        <Link href="/documents" className={buttonVariants({ variant: "outline" })}>
          {t("back")}
        </Link>
      }
    />
  );
}
