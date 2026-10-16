"use client";

import {
  Check,
  ChevronDown,
  Copy,
  Eye,
  Mail,
  Sparkles,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useState,
  useTransition,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import {
  markLinkCopied,
  markLinkSent,
  setLinkRecipient,
  setLinkShared,
} from "@/app/(dashboard)/links/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { composeUrl, shareDraft } from "@/lib/closing/share/compose";
import { cn } from "@/lib/utils";

import { LinkSettingsPanel } from "./link-settings-panel";

/**
 * Right after a document is dropped: the link is there, one click sends it.
 * Who it is for and the settings are optional, never in the way.
 */
export function ShareReady({
  linkId,
  url,
  title,
  sent,
  copied: wasCopied = false,
  recipient,
  mailClient,
  signature,
  processing,
  summary,
  notice,
  shared,
  welcome,
  settings,
}: {
  linkId: string;
  url: string;
  /** Subject of the email, "Devis Acme". */
  title: string;
  sent: boolean;
  /** Copied or handed to the mail client, not confirmed sent yet. */
  copied?: boolean;
  recipient: { email: string; firstName: string | null } | null;
  mailClient: string | null;
  signature: string | null;
  /** The document is still being read: everything works, the AI tunes the settings after. */
  processing: boolean;
  /** "Email demandé", "Expire dans 15 j"… */
  summary: string[];
  /** What the defaults chose on their own, said once. */
  notice: string | null;
  /** One link for many readers, each identified by their email. */
  shared: boolean;
  /** The seller's video or voice message, optional. */
  welcome: ReactNode;
  settings: ComponentProps<typeof LinkSettingsPanel>;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [who, setWho] = useState("");
  const [pending, startTransition] = useTransition();

  // Copying is not sending: the link counts as sent once the prospect opens it, or once the seller says so
  function noteCopied() {
    if (sent) return;
    startTransition(async () => {
      await markLinkCopied(linkId);
      router.refresh();
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Lien copié. Collez-le dans votre message.");
      noteCopied();
    } catch {
      toast.error("Copie impossible : sélectionnez le lien à la main.");
    }
  }

  function sendByEmail() {
    const draft = shareDraft({
      url,
      title,
      to: recipient?.email,
      firstName: recipient?.firstName,
      signature,
    });
    const target = composeUrl(mailClient, draft);
    if (!target) return void copy();
    if (target.startsWith("mailto:")) window.location.href = target;
    else window.open(target, "_blank", "noopener");
    noteCopied();
  }

  function confirmSent() {
    startTransition(async () => {
      await markLinkSent(linkId);
      router.refresh();
    });
  }

  function switchMode(next: boolean) {
    if (next === shared) return;
    startTransition(async () => {
      const result = await setLinkShared(linkId, next);
      if ("error" in result) return void toast.error(result.error);
      router.refresh();
    });
  }

  function saveRecipient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!who.trim()) return;
    startTransition(async () => {
      const result = await setLinkRecipient(linkId, who);
      if (result?.error) return void toast.error(result.error);
      setWho("");
      router.refresh();
    });
  }

  return (
    <section className="space-y-5 border-y border-foreground bg-card px-4 py-5 sm:px-6 sm:py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-heading">
            {sent
              ? shared
                ? "C'est en ligne. Chaque nouveau lecteur apparaît ici."
                : "C'est parti. Vous serez prévenu dès qu'il l'ouvre."
              : wasCopied
                ? "Lien copié"
                : "Votre lien est prêt"}
          </h2>
          {!sent && wasCopied && (
            <div className="flex max-w-xl flex-wrap items-center gap-x-3 gap-y-2">
              <p className="text-body text-muted-foreground">
                Collez-le dans votre message et envoyez-le. Le suivi démarre dès qu&apos;il l&apos;ouvre.
              </p>
              <Button size="sm" variant="outline" disabled={pending} onClick={confirmSent}>
                <Check />
                C&apos;est envoyé
              </Button>
            </div>
          )}
          {!sent && !wasCopied && (
            <p className="max-w-xl text-body text-muted-foreground">
              {shared
                ? "Postez-le, mettez-le en signature ou transférez-le : chaque lecteur donne son email et reçoit son propre lien, suivi comme un deal."
                : "Il l'ouvre et lit tout de suite, sans rien remplir. Vous saurez quelles pages, combien de temps, et quand relancer."}
            </p>
          )}
        </div>
      </div>

      {shared ? null : recipient ? (
        <p className="text-small text-muted-foreground">
          Pour <span className="text-foreground">{recipient.email}</span>
        </p>
      ) : (
        <form onSubmit={saveRecipient} className="space-y-1.5">
          <label htmlFor="share-who" className="text-small font-medium">
            Pour qui est ce lien ?{" "}
            <span className="font-normal text-muted-foreground">
              (facultatif)
            </span>
          </label>
          <div className="flex gap-2">
            <Input
              id="share-who"
              value={who}
              onChange={(e) => setWho(e.target.value)}
              placeholder="Marie Dupont, Acme ou marie@acme.fr"
              className="h-10"
              disabled={pending}
            />
            <Button
              type="submit"
              variant="outline"
              size="lg"
              disabled={pending || !who.trim()}
            >
              Enregistrer
            </Button>
          </div>
          <p className="text-micro text-muted-foreground">
            Le deal portera ce nom. Avec un email, Clozer pourra le relancer.
          </p>
        </form>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={copy}
          className="h-10 min-w-0 flex-1 truncate rounded-lg border border-input bg-muted/50 px-3 text-left font-mono text-small transition-colors hover:border-foreground/60"
          title="Copier le lien"
        >
          {url.replace(/^https?:\/\//, "")}
        </button>
        <Button size="lg" onClick={copy}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Copié" : "Copier le lien"}
        </Button>
        <Button size="lg" variant="outline" onClick={sendByEmail}>
          <Mail />
          Envoyer par email
        </Button>
      </div>

      {processing && (
        <p className="flex items-center gap-2 text-small text-muted-foreground">
          <Sparkles className="size-4 shrink-0 animate-pulse" aria-hidden />
          Clozer lit votre document pour adapter les réglages. Vous pouvez déjà
          l&apos;envoyer.
        </p>
      )}
      {notice && (
        <p className="flex items-center gap-2 text-small">
          <Sparkles className="size-4 shrink-0" aria-hidden />
          {notice}
        </p>
      )}

      <div className="space-y-2 border-t border-border pt-4">
        <p className="text-body font-medium">
          Mot d&apos;accueil{" "}
          <span className="font-normal text-muted-foreground">
            (facultatif)
          </span>
        </p>
        <p className="text-small text-muted-foreground">
          Une vidéo ou un vocal pour présenter le document : le prospect voit
          votre bulle dès l&apos;ouverture.
        </p>
        {welcome}
      </div>

      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setShowSettings((open) => !open)}
          aria-expanded={showSettings}
          className="flex w-full flex-wrap items-center gap-x-1.5 gap-y-1 text-left text-small"
        >
          {summary.map((item) => (
            <span
              key={item}
              className="rounded-sm bg-muted px-2 py-0.5 text-muted-foreground"
            >
              {item}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 px-1 text-muted-foreground hover:text-foreground">
            Personnaliser
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                showSettings && "rotate-180",
              )}
              aria-hidden
            />
          </span>
        </button>
        {showSettings && <LinkSettingsPanel {...settings} />}
      </div>

      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-small text-muted-foreground hover:text-foreground"
      >
        <Eye className="size-4" aria-hidden />
        Voir ce que verra le prospect
      </a>

      {/* The everyday case is one link for one person; broadcasting is the exception, one line away */}
      {!sent && (
        <p className="flex items-start gap-2 border-t border-border pt-4 text-small text-muted-foreground">
          <Users className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {shared ? (
              <>
                Lien ouvert à tous : chaque lecteur donne son email et reçoit son propre lien.{" "}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => switchMode(false)}
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  Revenir à un lien pour une personne
                </button>
              </>
            ) : (
              <>
                Vous voulez le diffuser largement (post, plaquette, signature) ?{" "}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => switchMode(true)}
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  En faire un lien ouvert à tous
                </button>
                , chaque lecteur donnera son email.
              </>
            )}
          </span>
        </p>
      )}
    </section>
  );
}
