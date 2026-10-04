"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { logSellerActivity, snoozeDeal, type LinkFormState } from "@/app/(dashboard)/links/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { SELLER_ACTIVITY_LABELS } from "./labels";

const TYPES = ["CALL", "EMAIL_REPLY_RECEIVED", "MEETING", "NOTE"] as const;

// Calls, replies and meetings happen outside Clozer: logging them keeps the advice honest
export function SellerActivityForm({ linkId }: { linkId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<LinkFormState, FormData>(
    logSellerActivity.bind(null, linkId),
    null,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) {
      toast.success("Échange noté");
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3 px-4 py-3">
      <fieldset className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
        <legend className="sr-only">Type d&apos;échange</legend>
        {TYPES.map((type, i) => (
          <label key={type} className="flex cursor-pointer items-center gap-1.5">
            <input type="radio" name="type" value={type} defaultChecked={i === 0} className="accent-foreground" />
            {SELLER_ACTIVITY_LABELS[type]}
          </label>
        ))}
      </fieldset>
      <Textarea name="note" rows={2} aria-label="Ce qui s'est dit" placeholder="Ce qui s'est dit, en deux mots" />
      <div className="space-y-1.5">
        <Label htmlFor="occurredAt">Quand</Label>
        <Input id="occurredAt" name="occurredAt" type="datetime-local" />
        <p className="text-xs text-muted-foreground">Laissez vide pour maintenant.</p>
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Enregistrement…" : "Noter l'échange"}
      </Button>
    </form>
  );
}

export function SnoozeControl({ linkId, snoozedUntil }: { linkId: string; snoozedUntil: string | null }) {
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState("");

  if (snoozedUntil) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
        <span>
          En pause jusqu&apos;au{" "}
          {new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(new Date(snoozedUntil))}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await snoozeDeal(linkId, null);
              toast.success("Le deal reprend");
            })
          }
        >
          Reprendre
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-1.5 px-4 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await snoozeDeal(linkId, date);
          if (result.error) toast.error(result.error);
          else toast.success("Deal en pause, plus de relance d'ici là");
        });
      }}
    >
      <Label htmlFor="snoozeUntil">Mettre en pause jusqu&apos;au</Label>
      <div className="flex gap-2">
        <Input id="snoozeUntil" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Pause
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Le prospect revient vers vous plus tard ? Clozer se tait d&apos;ici là.</p>
    </form>
  );
}
