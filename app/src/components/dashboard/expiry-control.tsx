"use client";

import { Hourglass } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { extendLink, setLinkExpiry, type ExpiryChangeResult } from "@/app/(dashboard)/links/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EXPIRY_PRESETS, EXTENSION_DAYS, endOfLocalDay, expiryFromPreset, type ExpiryPreset } from "@/lib/closing/expiry";
import { formatDate, formatRelative } from "@/lib/format";

const PRESET_LABELS: Record<ExpiryPreset, string> = { "48h": "48 h", "7d": "7 jours", "15d": "15 jours", "30d": "30 jours" };

function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Choice made in the seller's own time zone: "7 jours" ends that evening where they are. */
function useExpiryChoice() {
  const [choice, setChoice] = useState<Choice>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);

  function pick(next: Choice) {
    setChoice(next);
    setExpiresAt(next && next !== "date" ? expiryFromPreset(next, new Date(), browserTimeZone()) : null);
  }
  function pickDate(isoDate: string) {
    setExpiresAt(endOfLocalDay(isoDate, browserTimeZone()));
  }
  return { choice, expiresAt, pick, pickDate };
}

type Choice = ExpiryPreset | "date" | null;

function ChoiceChips({ choice, pick, withNone }: { choice: Choice; pick: (next: Choice) => void; withNone: boolean }) {
  const options: { value: Choice; label: string }[] = [
    ...(withNone ? [{ value: null, label: "Aucune" }] : []),
    ...EXPIRY_PRESETS.map((preset) => ({ value: preset, label: PRESET_LABELS[preset] })),
    { value: "date", label: "Date précise" },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(({ value, label }) => (
        <Button
          key={value ?? "none"}
          type="button"
          size="sm"
          variant={choice === value ? "default" : "outline"}
          aria-pressed={choice === value}
          onClick={() => pick(value)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

/** In the "new link" form: posts `expiresAt` as an ISO date, "" for none. */
export function ExpiryPicker() {
  const { choice, expiresAt, pick, pickDate } = useExpiryChoice();

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">
        Date d&apos;expiration <span className="font-normal text-muted-foreground">(facultatif)</span>
      </legend>
      <ChoiceChips choice={choice} pick={pick} withNone />
      {choice === "date" && (
        <Input type="date" aria-label="Date d'expiration" required onChange={(e) => pickDate(e.target.value)} />
      )}
      <input type="hidden" name="expiresAt" value={expiresAt?.toISOString() ?? ""} />
      <p className="text-sm text-muted-foreground">
        {expiresAt
          ? `Le lien se verrouille le ${formatDate(expiresAt)}. Sur un devis, le prospect voit le décompte.`
          : "Passé cette date, le prospect devra vous demander une prolongation."}
      </p>
    </fieldset>
  );
}

/** On the deal page: where the deadline stands, and one click to move it. */
export function ExpiryControl({
  linkId,
  expiresAt,
  requests,
  canEdit,
}: {
  linkId: string;
  expiresAt: string | null;
  /** Extension requests since the link expired. */
  requests: number;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const { choice, expiresAt: chosen, pick, pickDate } = useExpiryChoice();
  const deadline = expiresAt ? new Date(expiresAt) : null;
  // Frozen at mount: server and client render the same "il y a…" text
  const [now] = useState(() => new Date());
  const expired = !!deadline && deadline <= now;
  // Moving an expired date opens the link again, whatever the button
  const done = (otherwise: string) => (expired ? "Lien réactivé" : otherwise);

  function run(action: () => Promise<ExpiryChangeResult>, success: string) {
    startTransition(async () => {
      const result = await action();
      if ("error" in result) return void toast.error(result.error);
      const s = result.told > 1 ? "s" : "";
      toast.success(result.told ? `${success}, ${result.told} prospect${s} prévenu${s}` : success);
      setEditing(false);
      pick(null);
    });
  }

  return (
    <div className="space-y-3 px-4 py-3 text-sm">
      <p className="flex items-start gap-2">
        <Hourglass className={`mt-0.5 size-4 shrink-0 ${expired ? "text-destructive" : "text-muted-foreground"}`} aria-hidden />
        <span>
          {!deadline
            ? "Pas de date d'expiration."
            : expired
              ? `Expiré ${formatRelative(deadline, now)}, le prospect ne peut plus l'ouvrir.`
              : `Expire ${formatRelative(deadline, now)} (${formatDate(deadline)}).`}
          {expired && requests > 0 && (
            <span className="block font-medium">
              {requests} demande{requests > 1 ? "s" : ""} de prolongation
            </span>
          )}
        </span>
      </p>

      {canEdit && deadline && (
        <div className="flex flex-wrap items-center gap-1.5">
          {EXTENSION_DAYS.map((days) => (
            <Button
              key={days}
              size="sm"
              variant={expired ? "default" : "outline"}
              disabled={pending}
              onClick={() => run(() => extendLink(linkId, days), done("Échéance repoussée"))}
            >
              +{days} j
            </Button>
          ))}
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setEditing((v) => !v)}>
            Autre date
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => run(() => setLinkExpiry(linkId, null), done("Échéance retirée"))}
          >
            Retirer
          </Button>
        </div>
      )}

      {canEdit && (!deadline || editing) && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!chosen) return;
            run(() => setLinkExpiry(linkId, chosen.toISOString()), done("Échéance enregistrée"));
          }}
        >
          <ChoiceChips choice={choice} pick={pick} withNone={false} />
          {choice === "date" && (
            <div className="space-y-1">
              <Label htmlFor="expiryDate" className="sr-only">
                Date d&apos;expiration
              </Label>
              <Input id="expiryDate" type="date" required onChange={(e) => pickDate(e.target.value)} />
            </div>
          )}
          {chosen && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Jusqu&apos;au {formatDate(chosen)}</span>
              <Button type="submit" size="sm" disabled={pending}>
                Enregistrer
              </Button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
