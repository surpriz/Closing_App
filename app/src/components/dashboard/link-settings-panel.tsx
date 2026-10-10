"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveAsWorkspaceDefaults, setLinkSwitch, type LinkSwitch } from "@/app/(dashboard)/links/actions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

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
      {
        key: "ctaEnabled",
        label: "Valider ou demander un ajustement",
        hint: "Deux boutons en bas du document.",
        personalOnly: true,
      },
      { key: "chatEnabled", label: "Poser ses questions à l'assistant", hint: "Il répond à partir du document et vous transmet le reste." },
      { key: "voiceCommentsEnabled", label: "Laisser un vocal sur une page", hint: "Vous recevez l'audio et sa transcription.", pdfOnly: true },
    ],
  },
  {
    title: "Suivi",
    items: [
      {
        key: "followupsEnabled",
        label: "Relances préparées par Clozer",
        hint: "Coupé : le deal reste suivi, sans relance.",
        personalOnly: true,
      },
    ],
  },
];

/** Every setting of a link in one place, each saved as soon as it changes. */
export function LinkSettingsPanel({
  linkId,
  initial,
  expiresAt,
  requests,
  isPdf,
  shared,
  canSaveDefaults,
}: {
  linkId: string;
  initial: LinkSwitches;
  expiresAt: string | null;
  requests: number;
  isPdf: boolean;
  /** Shared link: the email is always asked, nothing to accept, no follow-ups. */
  shared: boolean;
  canSaveDefaults: boolean;
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
          <h3 className="text-sm font-medium text-muted-foreground">{group.title}</h3>
          <div className="divide-y divide-border rounded-xl bg-card ring-1 ring-border">
            {group.items
              .filter((item) => (isPdf || !item.pdfOnly) && !(shared && item.personalOnly))
              .map((item) => (
                <label key={item.key} className="flex cursor-pointer items-start justify-between gap-4 px-4 py-3">
                  <span className="text-sm">
                    {item.label}
                    {item.hint && <span className="block text-muted-foreground">{item.hint}</span>}
                  </span>
                  <Switch className="mt-0.5" checked={values[item.key]} onCheckedChange={(checked) => flip(item.key, checked)} />
                </label>
              ))}
            {group.title === "Accès" && (
              <ExpiryControl linkId={linkId} expiresAt={expiresAt} requests={requests} canEdit />
            )}
          </div>
        </section>
      ))}
      {shared && (
        <p className="text-sm text-muted-foreground">
          Lien partagé : chaque lecteur donne son email, sans bouton de validation ni relance automatique.
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
