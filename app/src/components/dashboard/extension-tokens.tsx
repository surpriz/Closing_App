"use client";

import { useState, useTransition } from "react";

import { revokeExtensionToken } from "@/app/extension/actions";
import { OutlookManifestLink } from "@/components/dashboard/outlook-manifest-link";
import { ExtensionStatus } from "@/components/onboarding/extension-status";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OUTLOOK_TOKEN_LABEL } from "@/lib/extension-tokens";
import type { ExtensionProbe } from "@/lib/onboarding";

export type ExtensionTokenRow = {
  id: string;
  label: string | null;
  hint: string;
  createdAt: string;
  lastUsedAt: string | null;
};

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function RevokeButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Révoquer
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Révoquer cet accès ?</DialogTitle>
          <DialogDescription>
            Chrome ou Outlook devra être reconnecté.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await revokeExtensionToken(id);
                setOpen(false);
              })
            }
          >
            {pending ? "Révocation…" : "Révoquer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TokenList({ tokens }: { tokens: ExtensionTokenRow[] }) {
  if (tokens.length === 0)
    return (
      <p className="px-5 py-3 text-small text-muted-foreground">
        Rien de connecté.
      </p>
    );
  return (
    <ul className="divide-y divide-border">
      {tokens.map((token) => (
        <li
          key={token.id}
          className="flex items-center justify-between gap-4 px-5 py-3"
        >
          <div className="min-w-0">
            <p className="text-body">
              {token.label ?? "Navigateur"}{" "}
              <span className="font-mono text-small text-muted-foreground">
                …{token.hint}
              </span>
            </p>
            <p className="text-small text-muted-foreground">
              Connecté le {dateFormat.format(new Date(token.createdAt))}
              {token.lastUsedAt &&
                ` · utilisé le ${dateFormat.format(new Date(token.lastUsedAt))}`}
            </p>
          </div>
          <RevokeButton id={token.id} />
        </li>
      ))}
    </ul>
  );
}

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col bg-card">
      <div className="space-y-0.5 px-5 pt-4 pb-3">
        <p className="text-body font-semibold">{title}</p>
        <p className="text-small text-muted-foreground">{hint}</p>
      </div>
      {children}
    </div>
  );
}

/** "Chrome et Outlook": one card per mail tool, with how to install it and what is connected. */
export function ExtensionTokens({
  tokens,
  chromeStoreUrl,
  probe,
}: {
  tokens: ExtensionTokenRow[];
  chromeStoreUrl: string | null;
  probe: ExtensionProbe;
}) {
  const chrome = tokens.filter((token) => token.label !== OUTLOOK_TOKEN_LABEL);
  const outlook = tokens.filter((token) => token.label === OUTLOOK_TOKEN_LABEL);

  return (
    <section id="extension" className="scroll-mt-24 space-y-3">
      <div className="space-y-1">
        <h2 className="text-heading">Chrome et Outlook</h2>
        <p className="text-body text-muted-foreground">
          Joignez un PDF dans votre messagerie, Clozer le remplace par un lien
          et vous prévient pendant la lecture.
        </p>
      </div>
      <div className="grid gap-px border-y border-foreground bg-border sm:grid-cols-2">
        <Card title="Chrome" hint="Gmail et Outlook sur le web.">
          <div className="px-5 pb-4">
            {chromeStoreUrl ? (
              <a
                href={chromeStoreUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "outline" })}
              >
                Installer dans Chrome
              </a>
            ) : (
              <p className="text-small text-muted-foreground">
                Bientôt sur le Chrome Web Store.
              </p>
            )}
          </div>
          <ExtensionStatus probe={probe} />
          <div className="border-t border-border">
            <TokenList tokens={chrome} />
          </div>
        </Card>
        <Card title="Outlook" hint="Installé sur Windows ou Mac.">
          <ol className="list-decimal space-y-1 px-5 pb-4 pl-9 text-small text-muted-foreground">
            <li>
              <OutlookManifestLink className="underline hover:text-foreground">
                Téléchargez le fichier manifeste
              </OutlookManifestLink>
              .
            </li>
            <li>
              Outlook › Compléments › Mes compléments › Ajouter à partir
              d&apos;un fichier.
            </li>
            <li>
              Dans un nouvel email, cliquez sur Clozer puis « Connecter Clozer
              ».
            </li>
          </ol>
          <p className="px-5 pb-4 text-small text-muted-foreground">
            Votre service informatique peut aussi le déployer pour toute
            l&apos;équipe depuis le centre d&apos;administration Microsoft 365.
          </p>
          <div className="border-t border-border">
            <TokenList tokens={outlook} />
          </div>
        </Card>
      </div>
    </section>
  );
}
