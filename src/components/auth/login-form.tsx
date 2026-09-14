"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      callbackURL: "/documents",
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
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Connexion</CardTitle>
        <CardDescription>
          Recevez un lien de connexion par email, sans mot de passe.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status === "sent" ? (
          <div className="space-y-4 text-sm">
            <p>
              Lien envoyé à <span className="font-medium">{email}</span>.
            </p>
            {devMode && devLink && (
              <div className="space-y-2 rounded-lg border border-dashed p-3">
                <p className="text-muted-foreground">
                  Mode dev : aucun service d&apos;email configuré.
                </p>
                <a
                  href={devLink}
                  className="inline-flex h-8 w-full items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
                >
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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="vous@entreprise.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={status === "sending"}>
              {status === "sending" ? "Envoi…" : "Recevoir le lien"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
