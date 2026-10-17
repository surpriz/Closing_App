"use client";

import { BellRing, Check, ExternalLink, PenLine, Send } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";

import { saveMailClient, saveOfferDescription } from "@/app/bienvenue/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  canInstallChromeExtension,
  MAIL_CLIENT_LABELS,
  MAIL_CLIENTS,
  OFFER_DESCRIPTION_MAX,
  toolFor,
  type MailClient,
} from "@/lib/onboarding";
import { cn } from "@/lib/utils";

import { IconRow, StepHeading } from "./parts";

export function DailyStep({
  askOffer,
  initialMailClient,
  connected,
  chromeStoreUrl,
}: {
  askOffer: boolean;
  initialMailClient: MailClient | null;
  connected: { chrome: boolean; outlook: boolean };
  chromeStoreUrl: string | null;
}) {
  return (
    <div className="space-y-10">
      <StepHeading
        title="Maintenant, pour de vrai."
        lead="Au quotidien, vous vendez comme avant. Clozer fait le suivi."
      />
      <ol className="space-y-6">
        <IconRow icon={Send} title="Vous envoyez le lien à votre prospect">
          Copiez le lien de votre document et collez-le dans votre email, à la place de la pièce jointe. Ou cliquez
          sur « Envoyer par email » : le message est déjà prêt.
        </IconRow>
        <IconRow icon={BellRing} title="Vous êtes prévenu quand il lit">
          Par email, et en direct sur votre tableau de bord. C&apos;est le bon moment pour appeler.
        </IconRow>
        <IconRow icon={PenLine} title="Vous validez les relances">
          Clozer les écrit au bon moment. Vous les retrouvez dans « Relances à valider ».
        </IconRow>
      </ol>
      <MailClientQuestion
        initial={initialMailClient}
        connected={connected}
        chromeStoreUrl={chromeStoreUrl}
      />
      {askOffer && <OfferField />}
    </div>
  );
}

/** Optional: lets the seller know whether there is something to plug into their mailbox, today or later. */
function MailClientQuestion({
  initial,
  connected,
  chromeStoreUrl,
}: {
  initial: MailClient | null;
  connected: { chrome: boolean; outlook: boolean };
  chromeStoreUrl: string | null;
}) {
  // Guessed from the email domain until the seller picks: only a pick is saved
  const [value, setValue] = useState(initial);

  function pick(client: MailClient) {
    setValue(client);
    void saveMailClient(client);
  }

  return (
    <div className="space-y-3">
      <p className="text-small font-medium">
        Vous écrivez vos emails depuis… <span className="font-normal text-muted-foreground">(facultatif)</span>
      </p>
      <div role="radiogroup" aria-label="Votre messagerie" className="flex flex-wrap gap-2">
        {MAIL_CLIENTS.map((client) => (
          <button
            key={client}
            type="button"
            role="radio"
            aria-checked={value === client}
            onClick={() => pick(client)}
            className={cn(
              "rounded-sm border border-border bg-card px-3 py-1.5 text-small transition-colors duration-150 outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/30",
              value === client && "border-foreground bg-foreground font-medium text-background hover:bg-foreground",
            )}
          >
            {MAIL_CLIENT_LABELS[client].title}
          </button>
        ))}
      </div>
      {value && toolFor(value) === "chrome" && chromeStoreUrl && !connected.chrome ? (
        <ExtensionOffer mailbox={value === "gmail" ? "Gmail" : "Outlook"} storeUrl={chromeStoreUrl} />
      ) : (
        value && <p className="text-small text-muted-foreground">{mailToolHint(value, connected, chromeStoreUrl)}</p>
      )}
    </div>
  );
}

function mailToolHint(
  client: MailClient | null,
  connected: { chrome: boolean; outlook: boolean },
  chromeStoreUrl: string | null,
): React.ReactNode {
  const tool = toolFor(client);
  if (tool === "manual") return "Parfait : copier-coller le lien dans votre email suffit.";
  if ((tool === "chrome" && connected.chrome) || (tool === "outlook_addin" && connected.outlook)) {
    return "Votre messagerie est déjà reliée à Clozer.";
  }
  if (tool === "chrome" && !chromeStoreUrl) {
    return "Bientôt, Clozer mettra le lien dans vos emails tout seul. En attendant, le copier-coller suffit.";
  }
  return (
    <>
      Clozer peut mettre le lien dans vos emails tout seul.{" "}
      <Link href="/bienvenue?etape=outil" className="text-foreground underline underline-offset-4">
        L&apos;installer, 2 minutes
      </Link>
      . Rien d&apos;obligatoire : le copier-coller marche aussi.
    </>
  );
}

const noSubscribe = () => () => {};

/** Gmail or Outlook on the web, store live, not paired yet: the extension is worth a real offer. Still optional. */
function ExtensionOffer({ mailbox, storeUrl }: { mailbox: string; storeUrl: string }) {
  // The user agent only exists in the browser: say nothing about it on the server
  const canInstall = useSyncExternalStore(
    noSubscribe,
    () => canInstallChromeExtension(navigator.userAgent),
    () => null,
  );

  return (
    <div className="space-y-3 border border-foreground bg-card px-4 py-4">
      <p className="font-semibold">
        {mailbox} : joignez votre PDF comme d&apos;habitude{" "}
        <span className="font-normal text-muted-foreground">(facultatif)</span>
      </p>
      <p className="text-small text-muted-foreground">
        L&apos;extension Clozer le remplace par un lien et vous prévient quand votre prospect le lit. Sans elle, le
        copier-coller du lien marche aussi.
      </p>
      {canInstall === true && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <a href={storeUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "default" })}>
            Ajouter à Chrome
            <ExternalLink />
          </a>
          <Link href="/bienvenue?etape=outil" className="text-small underline underline-offset-4">
            Puis la connecter, pas à pas
          </Link>
        </div>
      )}
      {canInstall === false && (
        <p className="text-small">
          Elle s&apos;installe depuis Chrome ou Edge, sur ordinateur. Rouvrez Clozer là-bas quand vous voudrez
          l&apos;ajouter.
        </p>
      )}
    </div>
  );
}

function OfferField() {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await saveOfferDescription(value);
      if (result.ok) setSaved(true);
      else toast.error("Impossible d'enregistrer. Vous pourrez le faire dans les réglages.");
    });
  }

  if (saved) {
    return (
      <p className="flex items-center gap-2 text-body text-muted-foreground">
        <Check className="size-4 text-success" aria-hidden />
        Offre enregistrée. Vous pourrez la compléter dans les réglages.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="offer">
        Ce que vous vendez <span className="font-normal text-muted-foreground">(facultatif)</span>
      </Label>
      <Textarea
        id="offer"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={OFFER_DESCRIPTION_MAX}
        rows={3}
        placeholder="Ex. : un logiciel de planning pour les cabinets d'architectes, de 200 à 800 € par mois."
      />
      <div className="flex items-center justify-between gap-4">
        <p className="text-small text-muted-foreground">
          Clozer s&apos;en sert pour écrire vos relances. Laissé vide, il déduit votre offre de votre premier document.
        </p>
        <Button variant="outline" size="sm" disabled={pending || !value.trim()} onClick={save}>
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
