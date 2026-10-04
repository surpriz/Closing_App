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
        <h2 className="text-heading">Extension Chrome</h2>
        <p className="text-body text-muted-foreground">
          Joignez un PDF dans Gmail ou Outlook, l&apos;extension le remplace par un lien Clozer. Connectez-la depuis
          son bouton dans la barre de Chrome.
        </p>
      </div>
      <div className="divide-y divide-border rounded-xl bg-card shadow-xs ring-1 ring-border">
        {tokens.length === 0 ? (
          <p className="px-5 py-4 text-body text-muted-foreground">Aucun navigateur connecté.</p>
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
