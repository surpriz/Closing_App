"use client";

import { useRef, useTransition } from "react";

import { setWorkspaceBilling } from "@/app/admin/workspace-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { report } from "./report";
import { ADMIN_SELECT } from "./styles";

/** Grant a plan outside Stripe, or move the trial end (0 days ends it now). */
export function WorkspaceBillingForm({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={form}
      className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:flex-wrap"
      action={(formData) =>
        startTransition(async () => {
          if (report(await setWorkspaceBilling(id, formData), "Facturation mise à jour")) form.current?.reset();
        })
      }
    >
      <select name="grant" defaultValue="" aria-label="Plan accordé" className={ADMIN_SELECT}>
        <option value="">Plan : inchangé</option>
        <option value="solo">Accorder Solo</option>
        <option value="team">Accorder Équipe</option>
        <option value="enterprise">Accorder Entreprise</option>
        <option value="none">Retirer le plan accordé</option>
      </select>
      <Input name="trialDays" type="number" min={0} max={365} placeholder="Essai : jours restants" aria-label="Jours d'essai" className="sm:w-48" />
      <Input name="reason" required placeholder="Motif" aria-label="Motif" className="sm:flex-1" />
      <Button type="submit" variant="outline" disabled={pending}>
        Enregistrer
      </Button>
    </form>
  );
}
