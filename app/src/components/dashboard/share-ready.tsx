"use client";

import { Check, ChevronDown, Copy, Eye, Mail, Sparkles, User, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { markLinkSent, setLinkRecipient, setLinkShared } from "@/app/(dashboard)/links/actions";
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

  function confirmSent() {
    if (sent) return;
    startTransition(async () => {
      await markLinkSent(linkId);
      router.refresh();
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Lien copié. Collez-le dans votre message.");
      confirmSent();
    } catch {
      toast.error("Copie impossible : sélectionnez le lien à la main.");
    }
  }

  function sendByEmail() {
    const draft = shareDraft({ url, title, to: recipient?.email, firstName: recipient?.firstName, signature });
    const target = composeUrl(mailClient, draft);
    if (!target) return void copy();
    if (target.startsWith("mailto:")) window.location.href = target;
    else window.open(target, "_blank", "noopener");
    confirmSent();
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
    <section className="space-y-5 rounded-2xl bg-card p-5 ring-1 ring-border sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-medium tracking-[-0.01em]">
            {sent
              ? shared
                ? "C'est en ligne. Chaque nouveau lecteur apparaît ici."
                : "C'est parti. Vous serez prévenu dès qu'il l'ouvre."
              : "Votre lien est prêt"}
          </h2>
          {!sent && (
            <p className="max-w-xl text-sm text-muted-foreground">
              {shared
                ? "Postez-le, mettez-le en signature ou transférez-le : chaque lecteur donne son email et reçoit son propre lien, suivi comme un deal."
                : "Envoyez-le comme vous voulez : vous saurez qui le lit, quelles pages, et quand relancer."}
            </p>
          )}
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Pour qui est ce lien">
          {[
            { value: false, label: "Une personne", icon: User },
            { value: true, label: "Plusieurs personnes", icon: Users },
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={shared === value}
              disabled={pending}
              onClick={() => switchMode(value)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors disabled:opacity-60",
                shared === value ? "bg-card shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={copy}
          className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2.5 text-left font-mono text-sm ring-1 ring-border hover:ring-foreground/30"
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

      {shared ? null : recipient ? (
        <p className="text-sm text-muted-foreground">
          Pour <span className="text-foreground">{recipient.email}</span>
        </p>
      ) : (
        <form onSubmit={saveRecipient} className="flex gap-2">
          <Input
            value={who}
            onChange={(e) => setWho(e.target.value)}
            placeholder="Pour qui ? Un email ou un nom (facultatif)"
            aria-label="Pour qui"
            className="h-9"
            disabled={pending}
          />
          <Button type="submit" variant="outline" size="lg" disabled={pending || !who.trim()}>
            OK
          </Button>
        </form>
      )}

      {processing && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="size-4 shrink-0 animate-pulse" aria-hidden />
          Clozer lit votre document pour adapter les réglages. Vous pouvez déjà l&apos;envoyer.
        </p>
      )}
      {notice && (
        <p className="flex items-center gap-2 text-sm">
          <Sparkles className="size-4 shrink-0" aria-hidden />
          {notice}
        </p>
      )}

      <div className="space-y-2 border-t border-border pt-4">
        <p className="text-sm font-medium">
          Mot d&apos;accueil <span className="font-normal text-muted-foreground">(facultatif)</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Une vidéo ou un vocal pour présenter le document : le prospect voit votre bulle dès l&apos;ouverture.
        </p>
        {welcome}
      </div>

      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setShowSettings((open) => !open)}
          aria-expanded={showSettings}
          className="flex w-full flex-wrap items-center gap-1.5 text-left text-sm"
        >
          {summary.map((item) => (
            <span key={item} className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground ring-1 ring-border">
              {item}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 px-1 text-muted-foreground hover:text-foreground">
            Personnaliser
            <ChevronDown className={cn("size-4 transition-transform", showSettings && "rotate-180")} aria-hidden />
          </span>
        </button>
        {showSettings && <LinkSettingsPanel {...settings} />}
      </div>

      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <Eye className="size-4" aria-hidden />
        Voir ce que verra le prospect
      </a>
    </section>
  );
}
