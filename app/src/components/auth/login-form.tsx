"use client";

import { useState, type FormEvent } from "react";

import { Logo } from "@/components/brand/logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

type Status = "idle" | "sending" | "sent" | "error";

export function LoginForm({ devMode }: { devMode: boolean }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError(null);
    setDevLink(null);

    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL: "/dashboard",
    });

    if (error) {
      setStatus("error");
      setError(error.message ?? "Envoi impossible, réessayez.");
      return;
    }

    setStatus("sent");

    if (devMode) {
      const res = await fetch(`/api/dev/magic-link?email=${encodeURIComponent(email)}`);
      const data = (await res.json().catch(() => null)) as { url?: string | null } | null;
      setDevLink(data?.url ?? null);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-8">
      <Logo />
      <div className="space-y-2">
        <h1 className="text-title [font-stretch:88%]">
          {status === "sent" ? "Regardez vos emails." : "Connexion à Clozer"}
        </h1>
        <p className="text-body text-muted-foreground">
          {status === "sent" ? (
            <>
              Un lien de connexion vient de partir vers <span className="text-foreground">{email}</span>.
              Cliquez dessus pour entrer.
            </>
          ) : (
            "Pas de mot de passe : on vous envoie un lien par email."
          )}
        </p>
      </div>

      {status === "sent" ? (
        <div className="space-y-3 text-sm">
          {devMode && devLink && (
            <div className="space-y-3 rounded-xl border border-dashed border-input p-4">
              <p className="text-muted-foreground">Mode dev : aucun service d&apos;email configuré.</p>
              <a href={devLink} className={buttonVariants({ size: "lg", className: "w-full" })}>
                Ouvrir le lien de connexion
              </a>
            </div>
          )}
          <Button variant="ghost" className="w-full" onClick={() => setStatus("idle")}>
            Utiliser une autre adresse
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Votre email professionnel</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              placeholder="vous@entreprise.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 bg-card text-body"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" size="lg" className="h-10 w-full" disabled={status === "sending"}>
            {status === "sending" ? "Envoi…" : "Recevoir le lien de connexion"}
          </Button>
        </form>
      )}
    </div>
  );
}
