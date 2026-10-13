"use client";

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

type Item = { key: LinkSwitch; label: string; hint?: string; pdfOnly?: boolean; personalOnly?: boolean };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Accès",
    items: [
      {
        key: "requireEmail",
        label: "Demander son email avant de lire",
        hint: "Vous savez qui lit, même si le lien circule.",
        personalOnly: true,
      },
    ],
  },
  {
    title: "Ce que le prospect peut faire",
    items: [
      { key: "ctaEnabled", label: "Valider ou demander un ajustement", hint: "Deux boutons en bas du document." },
      { key: "bookingEnabled", label: "Prendre rendez-vous", hint: "Votre agenda, à côté des autres boutons." },
      { key: "chatEnabled", label: "Poser ses questions à l'assistant", hint: "Il répond à partir du document et vous transmet le reste." },
      { key: "voiceCommentsEnabled", label: "Laisser un vocal sur une page", hint: "Vous recevez l'audio et sa transcription.", pdfOnly: true },
    ],
  },
  {
    title: "Suivi",
    items: [
      { key: "followupsEnabled", label: "Relances préparées par Clozer", hint: "Coupé : le deal reste suivi, sans relance." },
    ],
  },
];

const VIDEO_CTA = { label: "Demander un devis", hint: "Un bouton sous la vidéo." };

/** Booking page of this link, saved on blur. Empty = the seller's own page. */
function BookingUrlField({ linkId, url, fallback }: { linkId: string; url: string; fallback: string | null }) {
  const [saved, setSaved] = useState(url);

  return (
    <div className="space-y-1.5 px-4 py-3 text-small">
      <label htmlFor="link-booking-url">Lien de l&apos;agenda</label>
      <Input
        id="link-booking-url"
        type="text"
        inputMode="url"
        defaultValue={url}
        placeholder={fallback ?? "https://calendly.com/vous/30min"}
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
          ? "Vide : votre agenda, réglé dans Réglages. Collez un autre lien pour ce prospect seulement."
          : "Aucun agenda dans vos réglages : collez un lien pour proposer un rendez-vous sur ce lien."}
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

  function flip(key: LinkSwitch, value: boolean) {
    setValues((current) => ({ ...current, [key]: value }));
    startTransition(async () => {
      try {
        const result = await setLinkSwitch(linkId, key, value);
        if ("error" in result) throw new Error(result.error);
      } catch {
        setValues((current) => ({ ...current, [key]: !value }));
        toast.error("Réglage non enregistré, réessayez.");
      }
    });
  }

  function keepAsDefaults() {
    startTransition(async () => {
      const result = await saveAsWorkspaceDefaults(linkId);
      if (result.error) toast.error(result.error);
      else toast.success("Vos prochains liens partiront avec ces réglages.");
    });
  }

  return (
    <div className="space-y-6">
      {GROUPS.map((group) => (
        <section key={group.title} className="space-y-2">
          <h3 className="text-small font-medium text-muted-foreground">{group.title}</h3>
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {group.items
              .filter((item) => (kind === "FILE" || !item.pdfOnly) && !(shared && item.personalOnly))
              // Under a video pitch, the buttons are "Demander un devis"
              .map((item) => (kind === "VIDEO" && item.key === "ctaEnabled" ? { ...item, ...VIDEO_CTA } : item))
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
            {group.title === "Accès" && (
              <div id="expiration" className="scroll-mt-20">
                <ExpiryControl linkId={linkId} expiresAt={expiresAt} requests={requests} canEdit />
              </div>
            )}
          </div>
        </section>
      ))}
      {shared && (
        <p className="text-small text-muted-foreground">
          Chaque lecteur donne son email et reçoit son propre lien, avec ces réglages. Ses relances attendent
          toujours votre feu vert : son adresse a été tapée, pas donnée par vous.
        </p>
      )}
      {canSaveDefaults && !shared && (
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={keepAsDefaults}>
          Garder ces réglages pour mes prochains liens
        </Button>
      )}
    </div>
  );
}
