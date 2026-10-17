"use client";

import { Hourglass } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { extendLink, setLinkExpiry, type ExpiryChangeResult } from "@/app/(dashboard)/links/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EXPIRY_PRESETS, EXTENSION_DAYS, endOfLocalDay, expiryFromPreset, type ExpiryPreset } from "@/lib/closing/expiry";
import { formatDate, formatRelative } from "@/lib/format";

const PRESET_KEYS = {
  "48h": "preset48h",
  "7d": "preset7d",
  "15d": "preset15d",
  "30d": "preset30d",
} as const satisfies Record<ExpiryPreset, string>;

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
  const t = useTranslations("deal.expiryControl");
  const options: { value: Choice; label: string }[] = [
    ...(withNone ? [{ value: null, label: t("none") }] : []),
    ...EXPIRY_PRESETS.map((preset) => ({ value: preset, label: t(PRESET_KEYS[preset]) })),
    { value: "date", label: t("exactDate") },
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
  const t = useTranslations("deal.expiryControl");
  const locale = useLocale();
  const [editing, setEditing] = useState(false);
  const { choice, expiresAt: chosen, pick, pickDate } = useExpiryChoice();
  const deadline = expiresAt ? new Date(expiresAt) : null;
  // Frozen at mount: server and client render the same "il y a…" text
  const [now] = useState(() => new Date());
  const expired = !!deadline && deadline <= now;
  // Moving an expired date opens the link again, whatever the button
  const done = (otherwise: string) => (expired ? t("reactivated") : otherwise);

  function run(action: () => Promise<ExpiryChangeResult>, success: string) {
    startTransition(async () => {
      const result = await action();
      if ("error" in result) return void toast.error(result.error);
      toast.success(result.told ? t("told", { success, count: result.told }) : success);
      setEditing(false);
      pick(null);
    });
  }

  return (
    <div className="space-y-3 px-4 py-3 text-small">
      <p className="flex items-start gap-2">
        <Hourglass className={`mt-0.5 size-4 shrink-0 ${expired ? "text-destructive" : "text-muted-foreground"}`} aria-hidden />
        <span>
          {!deadline
            ? t("noExpiry")
            : expired
              ? t("expiredAgo", { when: formatRelative(deadline, locale, now) })
              : t("expiresIn", { when: formatRelative(deadline, locale, now), date: formatDate(deadline, locale) })}
          {expired && requests > 0 && (
            <span className="block font-medium">
              {t("requests", { count: requests })}
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
              onClick={() => run(() => extendLink(linkId, days), done(t("extended")))}
            >
              {t("plusDays", { days })}
            </Button>
          ))}
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setEditing((v) => !v)}>
            {t("otherDate")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => run(() => setLinkExpiry(linkId, null), done(t("removed")))}
          >
            {t("remove")}
          </Button>
        </div>
      )}

      {canEdit && (!deadline || editing) && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!chosen) return;
            run(() => setLinkExpiry(linkId, chosen.toISOString()), done(t("saved")));
          }}
        >
          <ChoiceChips choice={choice} pick={pick} withNone={false} />
          {choice === "date" && (
            <div className="space-y-1">
              <Label htmlFor="expiryDate" className="sr-only">
                {t("dateLabel")}
              </Label>
              <Input id="expiryDate" type="date" required onChange={(e) => pickDate(e.target.value)} />
            </div>
          )}
          {chosen && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t("until", { date: formatDate(chosen, locale) })}</span>
              <Button type="submit" size="sm" disabled={pending}>
                {t("save")}
              </Button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
