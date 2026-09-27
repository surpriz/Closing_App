"use client";

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
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      title="Cette page n'a pas pu se charger."
      description="Souvent une coupure réseau passagère. Réessayez ; si ça persiste, rechargez la page."
      action={
        <Button variant="outline" onClick={() => retry()}>
          Réessayer
        </Button>
      }
    />
  );
}
