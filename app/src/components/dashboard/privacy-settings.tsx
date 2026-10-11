"use client";

import { useActionState, useEffect, useTransition } from "react";
import { toast } from "sonner";

import {
  deleteAccountAction,
  deleteWorkspaceAction,
  eraseProspect,
  lookupProspect,
  type LookupState,
  type PrivacyActionState,
  type ProspectLookup,
} from "@/app/(dashboard)/settings/privacy-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PRIVACY_POLICY_URL } from "@/components/viewer/privacy-notice";

function plural(count: number, word: string) {
  return `${count} ${word}${count > 1 ? "s" : ""}`;
}

function EraseProspectButton({ lookup }: { lookup: ProspectLookup }) {
  const [pending, startTransition] = useTransition();
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>Tout supprimer</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer les données de {lookup.email} ?</DialogTitle>
          <DialogDescription>
            Lectures, messages, commentaires vocaux et relances liés à cette adresse disparaissent pour de bon.
            {lookup.signatures > 0 &&
              ` Les ${plural(lookup.signatures, "validation")} signée${lookup.signatures > 1 ? "s" : ""} reste${lookup.signatures > 1 ? "nt" : ""} : c'est la preuve de l'accord, gardée 5 ans.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await eraseProspect(lookup.email);
                if (result?.error) toast.error(result.error);
                else toast.success("Données supprimées");
              })
            }
          >
            {pending ? "Suppression…" : "Supprimer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProspectRequest() {
  const [state, formAction, pending] = useActionState<LookupState, FormData>(lookupProspect, null);
  const lookup = state?.result;
  const found = lookup && (lookup.prospects > 0 || lookup.views > 0);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <div className="space-y-3 px-5 py-4">
      <div className="space-y-1">
        <p className="text-body font-medium">Demande d&apos;un prospect</p>
        <p className="text-small text-muted-foreground">
          Un prospect veut savoir ce que vous avez sur lui, ou être oublié ? Cherchez son email, envoyez-lui
          l&apos;export ou supprimez tout. Répondez sous un mois.
        </p>
      </div>
      <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
        <Input name="email" type="email" required placeholder="prospect@entreprise.fr" aria-label="Email du prospect" className="sm:flex-1" />
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Recherche…" : "Chercher"}
        </Button>
      </form>
      {lookup &&
        (found ? (
          <div className="flex flex-col gap-3 rounded-lg bg-muted/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-small">
              {plural(lookup.links, "lien")}, {plural(lookup.views, "lecture")}
              {lookup.signatures > 0 && `, ${plural(lookup.signatures, "signature")}`}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                render={<a href={`/api/privacy/prospect?email=${encodeURIComponent(lookup.email)}`} download />}
                nativeButton={false}
              >
                Exporter
              </Button>
              <EraseProspectButton key={lookup.email} lookup={lookup} />
            </div>
          </div>
        ) : (
          <p className="text-small text-muted-foreground">Rien pour {lookup.email} dans cet espace.</p>
        ))}
    </div>
  );
}

function ConfirmedDelete({
  title,
  description,
  trigger,
  confirmLabel,
  confirmValue,
  action,
}: {
  title: string;
  description: string;
  trigger: string;
  confirmLabel: string;
  confirmValue: string;
  action: (prev: PrivacyActionState, formData: FormData) => Promise<PrivacyActionState>;
}) {
  const [state, formAction, pending] = useActionState<PrivacyActionState, FormData>(action, null);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="sm" className="text-destructive" />}>{trigger}</DialogTrigger>
      <DialogContent>
        <form action={formAction} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <label className="block space-y-1.5 text-small">
            <span>
              {confirmLabel} <strong>{confirmValue}</strong>
            </span>
            <Input name="confirm" required autoComplete="off" />
          </label>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Annuler</DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Suppression…" : "Supprimer définitivement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Row({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-0.5">
        <p className="text-body font-medium">{title}</p>
        <p className="text-small text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function PrivacySettings({
  workspaceName,
  isManager,
  isOwner,
}: {
  workspaceName: string;
  isManager: boolean;
  isOwner: boolean;
}) {
  return (
    <section id="donnees" className="scroll-mt-24 space-y-3">
      <div className="space-y-1">
        <h2 className="text-heading">Données et confidentialité</h2>
        <p className="text-body text-muted-foreground">
          Le suivi de lecture est effacé 12 mois après la dernière activité d&apos;un lien. Un document supprimé part
          pour de bon au bout de 30 jours.{" "}
          <a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer" className="underline">
            Politique de confidentialité
          </a>
        </p>
      </div>
      <div className="divide-y divide-border rounded-xl bg-card shadow-xs ring-1 ring-border">
        {isManager && <ProspectRequest />}
        {isManager && (
          <Row title="Exporter l'espace" description="Liens, prospects, lectures et messages, en JSON.">
            <Button variant="outline" size="sm" render={<a href="/api/privacy/workspace" download />} nativeButton={false}>
              Télécharger
            </Button>
          </Row>
        )}
        <Row title="Supprimer mon compte" description="Vos deals restent dans l'espace, votre accès disparaît.">
          <ConfirmedDelete
            title="Supprimer votre compte ?"
            description="Vous serez déconnecté partout. Vos liens restent à l'équipe."
            trigger="Supprimer"
            confirmLabel="Tapez"
            confirmValue="SUPPRIMER"
            action={deleteAccountAction}
          />
        </Row>
        {isOwner && (
          <Row title="Supprimer l'espace" description="Documents, liens, prospects, fichiers et équipe. Irréversible.">
            <ConfirmedDelete
              title={`Supprimer « ${workspaceName} » ?`}
              description="Tout est effacé, fichiers compris, pour toute l'équipe. Exportez d'abord si besoin."
              trigger="Supprimer"
              confirmLabel="Tapez le nom de l'espace :"
              confirmValue={workspaceName}
              action={deleteWorkspaceAction}
            />
          </Row>
        )}
      </div>
    </section>
  );
}
