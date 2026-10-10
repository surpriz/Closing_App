"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";

import { claimOutlookPairing } from "@/app/extension/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OutlookConnect({
  account,
  doneHint,
}: {
  account: { email: string; workspace: string };
  /** Replaces the "back to Outlook, close this tab" line once connected. */
  doneHint?: React.ReactNode;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await claimOutlookPairing(code);
      if (result.ok) setDone(true);
      else setError(result.message);
    });
  }

  if (done) {
    return (
      <div className="space-y-4 rounded-xl bg-card p-6 shadow-xs ring-1 ring-border">
        <p className="flex items-center gap-2 text-heading">
          <Check className="size-4 text-success" aria-hidden />
          Outlook connecté
        </p>
        <p className="text-body text-muted-foreground">
          {doneHint ??
            "Revenez dans Outlook. Joignez un PDF à un email : Clozer vous proposera de le remplacer par un lien. Vous pouvez fermer cet onglet."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl bg-card p-6 shadow-xs ring-1 ring-border">
      <p className="text-body">
        Outlook créera les liens dans l&apos;espace <strong>{account.workspace}</strong>, au nom de {account.email}.
      </p>
      <div className="space-y-2">
        <Label htmlFor="outlook-code">Code affiché dans Outlook</Label>
        <Input
          id="outlook-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="XXXX-XXXX"
          autoComplete="off"
          spellCheck={false}
          className="font-mono tracking-widest uppercase"
          autoFocus
        />
        <p className="text-small text-muted-foreground">
          Le code s&apos;affiche dans le volet Clozer de votre Outlook. Ne saisissez jamais un code envoyé par quelqu&apos;un
          d&apos;autre.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-small text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending || !code.trim()}>
        {pending ? "Connexion…" : "Connecter Outlook"}
      </Button>
    </form>
  );
}
