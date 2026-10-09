"use client";

import { useTransition } from "react";

import { revokeExtensionToken } from "@/app/extension/actions";
import { Button } from "@/components/ui/button";

export type ExtensionTokenRow = {
  id: string;
  label: string | null;
  hint: string;
  createdAt: string;
  lastUsedAt: string | null;
};

const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

function RevokeButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => revokeExtensionToken(id))}
    >
      Révoquer
    </Button>
  );
}

export function ExtensionTokens({ tokens }: { tokens: ExtensionTokenRow[] }) {
  return (
    <section id="extension" className="scroll-mt-24 space-y-3">
      <div className="space-y-1">
        <h2 className="text-heading">Chrome et Outlook</h2>
        <p className="text-body text-muted-foreground">
          Joignez un PDF dans Gmail ou Outlook, Clozer le remplace par un lien. Dans Chrome, connectez l&apos;extension
          depuis son bouton dans la barre du navigateur.
        </p>
        <p className="text-body text-muted-foreground">
          Outlook installé sur Windows ou Mac : ajoutez le complément avec{" "}
          <a className="underline" href="/outlook/manifest.xml" download="clozer-outlook.xml">
            son fichier manifeste
          </a>{" "}
          (Outlook › Compléments › Mes compléments › Ajouter à partir d&apos;un fichier), puis cliquez sur « Clozer » dans un
          nouvel email. Votre service informatique peut aussi le déployer pour toute l&apos;équipe depuis le centre
          d&apos;administration Microsoft 365, avec le même fichier.
        </p>
      </div>
      <div className="divide-y divide-border rounded-xl bg-card shadow-xs ring-1 ring-border">
        {tokens.length === 0 ? (
          <p className="px-5 py-4 text-body text-muted-foreground">Rien de connecté pour l&apos;instant.</p>
        ) : (
          tokens.map((token) => (
            <div key={token.id} className="flex items-center justify-between gap-4 px-5 py-3">
              <div className="min-w-0">
                <p className="text-body">
                  {token.label ?? "Navigateur"} <span className="font-mono text-muted-foreground">…{token.hint}</span>
                </p>
                <p className="text-small text-muted-foreground">
                  Connecté le {dateFormat.format(new Date(token.createdAt))}
                  {token.lastUsedAt && ` · utilisé le ${dateFormat.format(new Date(token.lastUsedAt))}`}
                </p>
              </div>
              <RevokeButton id={token.id} />
            </div>
          ))
        )}
      </div>
    </section>
  );
}
