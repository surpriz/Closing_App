"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations("common.error");
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      title={t("title")}
      description={t("description")}
      action={
        <Button variant="outline" onClick={() => retry()}>
          {t("retry")}
        </Button>
      }
    />
  );
}
