"use client";

import { useTransition } from "react";

import { reactivateWorkspace, suspendWorkspace } from "@/app/admin/workspace-actions";
import { Button } from "@/components/ui/button";

import { ReasonDialog } from "./reason-dialog";
import { report } from "./report";

export function WorkspaceActions({ id, name, suspended }: { id: string; name: string; suspended: boolean }) {
  const [pending, startTransition] = useTransition();

  if (suspended) {
    return (
      <Button
        size="sm"
        disabled={pending}
        onClick={() => startTransition(async () => void report(await reactivateWorkspace(id), `${name} est réactivé`))}
      >
        Réactiver l&apos;espace
      </Button>
    );
  }

  return (
    <ReasonDialog
      trigger="Suspendre l'espace"
      variant="destructive"
      title={`Suspendre ${name} ?`}
      description="Tous les membres perdent l'accès, les liens envoyés ne s'ouvrent plus et les relances s'arrêtent. Aucune donnée n'est supprimée."
      action={(formData) => suspendWorkspace(id, formData)}
      success={`${name} est suspendu`}
      pendingLabel="Suspension…"
    />
  );
}
