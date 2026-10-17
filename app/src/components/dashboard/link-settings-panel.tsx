"use client";

import { useTranslations } from "next-intl";
import { Fragment, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  saveAsWorkspaceDefaults,
  setLinkBookingUrl,
  setLinkSwitch,
  type LinkSwitch,
} from "@/app/(dashboard)/links/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { DocumentKind } from "@/generated/prisma/enums";

import { ExpiryControl } from "./expiry-control";

export type LinkSwitches = Record<LinkSwitch, boolean>;

type PanelT = ReturnType<typeof useTranslations<"deal.linkSettingsPanel">>;

type Item = {
  key: LinkSwitch;
  label: string;
  hint?: string;
  pdfOnly?: boolean;
  /** A video has no text to translate. */
  noVideo?: boolean;
  personalOnly?: boolean;
};

const item = (t: PanelT, key: LinkSwitch, extra: Partial<Item> = {}): Item => ({
  key,
  label: t(key),
  hint: t(`${key}Hint`),
  ...extra,
});

const groups = (t: PanelT): { id: "access" | "prospect" | "tracking"; title: string; items: Item[] }[] => [
  {
    id: "access",
    title: t("groupAccess"),
    items: [item(t, "requireEmail", { personalOnly: true })],
  },
  {
    id: "prospect",
    title: t("groupProspect"),
    items: [
      item(t, "ctaEnabled"),
      item(t, "bookingEnabled"),
      item(t, "chatEnabled"),
      item(t, "voiceCommentsEnabled", { pdfOnly: true }),
      item(t, "translationEnabled", { noVideo: true }),
    ],
  },
  {
    id: "tracking",
    title: t("groupTracking"),
    items: [item(t, "followupsEnabled")],
  },
];

/** Booking page of this link, saved on blur. Empty = the seller's own page. */
function BookingUrlField({ linkId, url, fallback }: { linkId: string; url: string; fallback: string | null }) {
  const [saved, setSaved] = useState(url);
  const t = useTranslations("deal.linkSettingsPanel");

  return (
    <div className="space-y-1.5 px-4 py-3 text-small">
      <label htmlFor="link-booking-url">{t("bookingLabel")}</label>
      <Input
        id="link-booking-url"
        type="text"
        inputMode="url"
        defaultValue={url}
        placeholder={fallback ?? t("bookingPlaceholder")}
        onBlur={async (e) => {
          const next = e.target.value.trim();
          if (next === saved) return;
          const result = await setLinkBookingUrl(linkId, next);
          if ("error" in result) {
            toast.error(result.error);
            return;
          }
          e.target.value = result.bookingUrl ?? "";
          setSaved(result.bookingUrl ?? "");
        }}
      />
      <span className="block text-muted-foreground">
        {fallback
          ? t("bookingFallback")
          : t("bookingNone")}
      </span>
    </div>
  );
}

/** Every setting of a link in one place, each saved as soon as it changes. */
export function LinkSettingsPanel({
  linkId,
  initial,
  expiresAt,
  requests,
  kind,
  shared,
  canSaveDefaults,
  booking,
}: {
  linkId: string;
  initial: LinkSwitches;
  expiresAt: string | null;
  requests: number;
  kind: DocumentKind;
  /** Shared link: the email is always asked, nothing to accept, no follow-ups. */
  shared: boolean;
  canSaveDefaults: boolean;
  /** This link's booking page, and the seller's one it falls back to. */
  booking: { url: string; fallback: string | null };
}) {
  const [values, setValues] = useState(initial);
  const [pending, startTransition] = useTransition();
  const t = useTranslations("deal.linkSettingsPanel");
  const videoCta = { label: t("videoCta"), hint: t("videoCtaHint") };

  function flip(key: LinkSwitch, value: boolean) {
    setValues((current) => ({ ...current, [key]: value }));
    startTransition(async () => {
      try {
        const result = await setLinkSwitch(linkId, key, value);
        if ("error" in result) throw new Error(result.error);
      } catch {
        setValues((current) => ({ ...current, [key]: !value }));
        toast.error(t("saveFailed"));
      }
    });
  }

  function keepAsDefaults() {
    startTransition(async () => {
      const result = await saveAsWorkspaceDefaults(linkId);
      if (result.error) toast.error(result.error);
      else toast.success(t("defaultsSaved"));
    });
  }

  return (
    <div className="space-y-6">
      {groups(t).map((group) => (
        <section key={group.id} className="space-y-2">
          <h3 className="text-small font-medium text-muted-foreground">{group.title}</h3>
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {group.items
              .filter(
                (item) =>
                  (kind === "FILE" || !item.pdfOnly) &&
                  !(kind === "VIDEO" && item.noVideo) &&
                  !(shared && item.personalOnly),
              )
              // Under a video pitch, the buttons are "Demander un devis"
              .map((item) => (kind === "VIDEO" && item.key === "ctaEnabled" ? { ...item, ...videoCta } : item))
              .map((item) => (
                <Fragment key={item.key}>
                  <label className="flex cursor-pointer items-start justify-between gap-4 px-4 py-3">
                    <span className="text-body">
                      {item.label}
                      {item.hint && <span className="block text-small text-muted-foreground">{item.hint}</span>}
                    </span>
                    <Switch className="mt-0.5" checked={values[item.key]} onCheckedChange={(checked) => flip(item.key, checked)} />
                  </label>
                  {item.key === "bookingEnabled" && values.bookingEnabled && (
                    <BookingUrlField linkId={linkId} url={booking.url} fallback={booking.fallback} />
                  )}
                </Fragment>
              ))}
            {group.id === "access" && (
              <div id="expiration" className="scroll-mt-20">
                <ExpiryControl linkId={linkId} expiresAt={expiresAt} requests={requests} canEdit />
              </div>
            )}
          </div>
        </section>
      ))}
      {shared && (
        <p className="text-small text-muted-foreground">
          {t("sharedNote")}
        </p>
      )}
      {canSaveDefaults && !shared && (
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={keepAsDefaults}>
          {t("keepDefaults")}
        </Button>
      )}
    </div>
  );
}
