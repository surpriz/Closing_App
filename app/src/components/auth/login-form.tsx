"use client";

import { ArrowRight, Mail } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Logo } from "@/components/brand/logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRIVACY_POLICY_URL, TERMS_URL } from "@/components/viewer/privacy-notice";
import { authClient } from "@/lib/auth-client";

type Status = "idle" | "sending" | "sent" | "redirecting" | "error";

// Webmails worth a shortcut after "check your inbox"
const WEBMAILS: { match: RegExp; label: string; url: string }[] = [
  { match: /@(gmail|googlemail)\.com$/i, label: "Ouvrir Gmail", url: "https://mail.google.com/mail/u/0/#inbox" },
  {
    match: /@(outlook|hotmail|live|msn)\.[a-z.]+$/i,
    label: "Ouvrir Outlook",
    url: "https://outlook.live.com/mail/0/inbox",
  },
  { match: /@(yahoo|ymail)\.[a-z.]+$/i, label: "Ouvrir Yahoo Mail", url: "https://mail.yahoo.com" },
];

export function LoginForm({
  devMode,
  next,
  initialError = null,
  google = false,
  initialEmail = "",
  autoStart = null,
}: {
  devMode: boolean;
  next: string;
  initialError?: string | null;
  /** Google is configured server-side: offer it first. */
  google?: boolean;
  initialEmail?: string;
  /** Coming from the landing's signup form: start the chosen sign-in without a second click. */
  autoStart?: "email" | "google" | null;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState<Status>(initialError ? "error" : "idle");
  const [error, setError] = useState<string | null>(initialError);
  const [devLink, setDevLink] = useState<string | null>(null);
  const started = useRef(false);

  const errorCallbackURL = `/login?next=${encodeURIComponent(next)}`;

  async function sendMagicLink(address: string) {
    setStatus("sending");
    setError(null);
    setDevLink(null);

    const { error } = await authClient.signIn.magicLink({ email: address, callbackURL: next, errorCallbackURL });

    if (error) {
      setStatus("error");
      setError(error.message ?? "Envoi impossible, réessayez.");
      return;
    }

    setStatus("sent");

    if (devMode) {
      const res = await fetch(`/api/dev/magic-link?email=${encodeURIComponent(address)}`);
      const data = (await res.json().catch(() => null)) as { url?: string | null } | null;
      setDevLink(data?.url ?? null);
    }
  }

  async function signInWithGoogle() {
    setStatus("redirecting");
    setError(null);
    const { error } = await authClient.signIn.social({ provider: "google", callbackURL: next, errorCallbackURL });
    if (error) {
      setStatus("error");
      setError(error.message ?? "Connexion Google impossible, réessayez ou utilisez votre email.");
    }
  }

  useEffect(() => {
    if (started.current || !autoStart) return;
    started.current = true;
    const timer = window.setTimeout(() => {
      if (autoStart === "google") void signInWithGoogle();
      else if (initialEmail) void sendMagicLink(initialEmail);
    }, 0);
    return () => window.clearTimeout(timer);
    // Runs once, on arrival from the landing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMagicLink(email);
  }

  const busy = status === "sending" || status === "redirecting";

  return (
    <div className="w-full max-w-[25rem] animate-rise">
      <Logo />
      <h1 className="condensed mt-12 text-display">
        {status === "sent" ? "Regardez vos emails." : "Entrez dans Clozer."}
      </h1>
      <p className="mt-4 text-body text-muted-foreground">
        {status === "sent" ? (
          <>
            Le lien de connexion vient de partir vers <span className="font-medium text-foreground">{email}</span>.
            Cliquez dessus, vous êtes dedans.
          </>
        ) : (
          "Pas de mot de passe. Premier passage ? Votre compte se crée tout seul."
        )}
      </p>

      {status === "sent" ? (
        <div className="mt-8 space-y-3">
          {(() => {
            const webmail = WEBMAILS.find((w) => w.match.test(email));
            return (
              webmail && (
                <a
                  href={webmail.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ size: "xl", className: "w-full justify-between" })}
                >
                  {webmail.label}
                  <Mail data-icon="inline-end" />
                </a>
              )
            );
          })()}
          {devMode && devLink && (
            <div className="space-y-3 border border-dashed border-input p-4 text-small">
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
        <div className="mt-10">
          {google && (
            <>
              <Button
                type="button"
                size="xl"
                className="w-full justify-start gap-3 text-body"
                disabled={busy}
                onClick={() => void signInWithGoogle()}
              >
                <GoogleMark />
                {status === "redirecting" ? "Ouverture de Google…" : "Continuer avec Google"}
              </Button>
              <p className="my-6 flex items-center gap-3 text-small text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
                ou par email
              </p>
            </>
          )}
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="email">Votre email professionnel</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                autoFocus={!google}
                placeholder="vous@entreprise.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 text-body md:text-body"
              />
            </div>
            {error && (
              <p role="alert" className="text-small text-destructive">
                {error}
              </p>
            )}
            <Button
              type="submit"
              size="xl"
              variant={google ? "outline" : "default"}
              className="w-full justify-between"
              disabled={busy}
            >
              {status === "sending" ? "Envoi du lien…" : "Recevoir mon lien de connexion"}
              {status !== "sending" && <ArrowRight data-icon="inline-end" />}
            </Button>
          </form>
          <p className="mt-6 text-micro text-muted-foreground">
            En continuant, vous acceptez les{" "}
            <a href={TERMS_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              conditions d&apos;utilisation
            </a>{" "}
            et la{" "}
            <a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              politique de confidentialité
            </a>
            .
          </p>
        </div>
      )}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-6 rounded-sm bg-white p-0.5">
      <path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8.1z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7H2.1a11 11 0 0 0 0 9.9l3.7-2.8z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4z" />
    </svg>
  );
}
