"use client";

import { Check, Download, ExternalLink, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { OutlookConnect } from "@/components/dashboard/outlook-connect";
import { OutlookManifestLink } from "@/components/dashboard/outlook-manifest-link";
import { Button, buttonVariants } from "@/components/ui/button";
import { toolFor, type MailClient } from "@/lib/onboarding";

import { Instructions, StepHeading } from "./parts";

type Props = {
  mailClient: MailClient | null;
  connected: { chrome: boolean; outlook: boolean };
  account: { email: string; workspace: string };
  chromeStoreUrl: string | null;
  onChangeMailClient: () => void;
};

export function InstallStep(props: Props) {
  const tool = toolFor(props.mailClient);
  if (tool === "chrome") return <ChromeInstall {...props} />;
  if (tool === "outlook_addin") return <OutlookInstall {...props} />;
  return <ManualSend onChangeMailClient={props.onChangeMailClient} />;
}

function Connected({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 rounded-xl bg-success/10 px-4 py-3 text-body font-medium">
      <Check className="size-4 text-success" aria-hidden />
      {children}
    </p>
  );
}

// The extension can't be seen from this page: its token in the database is the only proof
function CheckAgain() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
      <RefreshCw className={pending ? "animate-spin" : undefined} />
      C&apos;est fait, vérifier
    </Button>
  );
}

function ChromeInstall({ mailClient, connected, chromeStoreUrl }: Props) {
  const mailbox = mailClient === "gmail" ? "Gmail" : "Outlook";
  return (
    <div className="space-y-8">
      <StepHeading
        title="Ajoutez l'extension Clozer"
        lead={`Elle fonctionne dans ${mailbox}, sur Chrome ou Edge. Vous joignez un PDF comme d'habitude, elle le remplace par un lien Clozer et vous prévient quand votre prospect le lit.`}
      />
      {connected.chrome ? (
        <Connected>Extension connectée. Vous pouvez continuer.</Connected>
      ) : (
        <Instructions
          items={[
            {
              text: chromeStoreUrl
                ? "Installez-la depuis le Chrome Web Store."
                : "Elle arrive très bientôt sur le Chrome Web Store. En attendant, créez vos liens depuis Clozer et collez-les dans vos emails : on vous montre comment juste après.",
              extra: chromeStoreUrl && (
                <a
                  href={chromeStoreUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: "default" })}
                >
                  Ajouter à Chrome
                  <ExternalLink />
                </a>
              ),
            },
            {
              text: "Épinglez-la dans la barre du navigateur (icône puzzle), cliquez sur Clozer puis sur « Connecter ».",
            },
            {
              text: `Ouvrez ${mailbox}, écrivez un email et joignez un PDF : Clozer vous propose de le remplacer par un lien.`,
              extra: <CheckAgain />,
            },
          ]}
        />
      )}
    </div>
  );
}

function OutlookInstall({ connected, account }: Props) {
  return (
    <div className="space-y-8">
      <StepHeading
        title="Ajoutez Clozer à Outlook"
        lead="Un complément pour Outlook sur Windows ou Mac. Il remplace vos PDF joints par des liens Clozer et vous montre qui lit, sans quitter Outlook."
      />
      {connected.outlook ? (
        <Connected>Outlook est connecté. Vous pouvez continuer.</Connected>
      ) : (
        <Instructions
          items={[
            {
              text: "Téléchargez le fichier du complément.",
              extra: (
                <OutlookManifestLink className={buttonVariants({ variant: "outline" })}>
                  <Download />
                  clozer-outlook.xml
                </OutlookManifestLink>
              ),
            },
            {
              text: (
                <>
                  Dans Outlook : <strong>Compléments › Mes compléments › Ajouter à partir d&apos;un fichier</strong>, puis
                  choisissez ce fichier. Sur l&apos;Outlook classique pour Windows, c&apos;est dans{" "}
                  <strong>Accueil › Obtenir des compléments</strong>.
                </>
              ),
            },
            { text: "Ouvrez un nouvel email et cliquez sur « Clozer » dans le ruban : un code s'affiche." },
            {
              text: "Saisissez ce code ici.",
              extra: (
                <OutlookConnect
                  account={account}
                  doneHint="Joignez un PDF à un email dans Outlook : Clozer vous proposera de le remplacer par un lien."
                />
              ),
            },
          ]}
        />
      )}
      <p className="text-small text-muted-foreground">
        Vous ne pouvez pas installer de complément ? Votre service informatique peut le déployer pour toute
        l&apos;équipe depuis le centre d&apos;administration Microsoft 365, avec le même fichier.
      </p>
    </div>
  );
}

function ManualSend({ onChangeMailClient }: Pick<Props, "onChangeMailClient">) {
  return (
    <div className="space-y-8">
      <StepHeading
        title="Pas d'outil à installer"
        lead="Clozer marche avec n'importe quelle messagerie : il suffit de coller le lien à la place de la pièce jointe."
      />
      <Instructions
        items={[
          { text: "Dans Clozer, ouvrez votre document et cliquez sur « Nouveau lien prospect »." },
          { text: "Le lien est copié. Collez-le dans votre email, à la place du PDF." },
          {
            text: "Pour tester, ouvrez-le dans une fenêtre privée : vos propres lectures ne comptent pas.",
          },
        ]}
      />
      <p className="text-small text-muted-foreground">
        Vous utilisez aussi Gmail ou Outlook ?{" "}
        <button type="button" onClick={onChangeMailClient} className="underline underline-offset-4">
          Changez votre réponse
        </button>{" "}
        : Clozer peut créer les liens pour vous.
      </p>
    </div>
  );
}
