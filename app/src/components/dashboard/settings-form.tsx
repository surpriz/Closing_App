"use client";

import { ChevronRight } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { saveWorkspaceSettings, type SettingsState } from "@/app/(dashboard)/settings/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Props = {
  initial: {
    version: string;
    alertChannels: string[];
    alertEmail: string;
    slackConfigured: boolean;
    outboundWebhookUrl: string;
    webhookSecret: string | null;
    aiTone: string;
    senderName: string;
    senderSignature: string;
    autonomy: "COPILOT" | "AUTOPILOT";
    offerDescription: string;
    targetCustomer: string;
    valueProps: string;
    commonObjections: string;
    avgSalesCycleDays: string;
    /** Document the offer was guessed from, until the seller saves. */
    offerInferredFrom: string | null;
  };
  /** The signed-in seller's own notification settings. */
  notifications: {
    emailActions: boolean;
    emailCallMoments: boolean;
    extensionCallMoments: boolean;
    morningDigest: boolean;
    digestHour: number;
    extensionConnected: boolean;
  };
  providers: { email: boolean; ai: string | null };
  /** Owners and admins set the workspace; everyone sets their own notifications. */
  canEditWorkspace: boolean;
};

const LOCKED_NOTE = "Réglé par un administrateur de l'espace.";

const DIGEST_HOURS = [6, 7, 8, 9, 10];

function Section({
  title,
  description,
  id,
  locked = false,
  children,
}: {
  title: string;
  description: React.ReactNode;
  id: string;
  /** Workspace-wide settings a plain member sees but cannot change. */
  locked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <div className="space-y-1">
        <h2 className="text-heading">{title}</h2>
        <p className="text-body text-muted-foreground">{description}</p>
        {locked && <p className="text-sm text-muted-foreground">{LOCKED_NOTE}</p>}
      </div>
      <fieldset
        disabled={locked}
        className="min-w-0 divide-y divide-border rounded-xl bg-card shadow-xs ring-1 ring-border disabled:opacity-60"
      >
        {children}
      </fieldset>
    </section>
  );
}

function Row({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="space-y-1.5 px-5 py-4">
      <div className="text-body leading-9">{children}</div>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** A number typed inside a sentence: "après [90] secondes". */
function Inline({ className, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      className={cn("mx-1 inline-flex h-8 w-16 [appearance:textfield] text-center tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none", className)}
    />
  );
}

function ChannelBox({
  name,
  value,
  label,
  defaultChecked,
  note,
  onChange,
}: {
  name: string;
  value: string;
  label: string;
  defaultChecked: boolean;
  note?: string;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <Checkbox name={name} value={value} defaultChecked={defaultChecked} onCheckedChange={onChange} />
      <span>{label}</span>
      {note && <span className="text-sm text-muted-foreground">{note}</span>}
    </label>
  );
}

export function SettingsForm({ initial, notifications, providers, canEditWorkspace }: Props) {
  const locked = !canEditWorkspace;
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(saveWorkspaceSettings, null);
  // Tied to the saved version: a successful save changes it, which clears the flag.
  const [dirtyVersion, setDirtyVersion] = useState<string | null>(null);
  const dirty = dirtyVersion === initial.version;
  const markDirty = () => setDirtyVersion(initial.version);

  // The seller's time zone, for the morning digest hour
  const timezoneRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (timezoneRef.current) timezoneRef.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, []);

  useEffect(() => {
    if (state?.ok) toast.success("Réglages enregistrés");
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} onInput={markDirty} onChange={markDirty} className="max-w-2xl">
      <input ref={timezoneRef} type="hidden" name="timezone" defaultValue="" />
      {/* Remount the fields after each save so uncontrolled inputs show stored values */}
      <div key={initial.version} className="space-y-12">
        <Section
          id="pilote"
          locked={locked}
          title="Pilote automatique"
          description={
            providers.ai
              ? "Clozer lit chaque deal comme un closer expérimenté : qui lit quoi, ce qui coince, quand relancer. Il prépare les relances tout seul."
              : "Les relances sont préparées à partir de règles simples tant qu'aucune IA n'est configurée."
          }
        >
          <Row hint="Dans tous les cas : 3 relances par mois et par contact au maximum, jamais juste après une lecture, toujours aux heures de bureau du prospect, et jamais d'allusion au fait que vous voyez ce qu'il lit.">
            <span className="mb-1 block">Quand Clozer a préparé une relance</span>
            <div className="flex flex-col gap-1.5">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="radio"
                  name="autonomy"
                  value="COPILOT"
                  defaultChecked={initial.autonomy === "COPILOT"}
                  className="mt-2.5 accent-foreground"
                />
                <span>
                  Je la relis et je valide
                  <span className="block text-sm text-muted-foreground">
                    Recommandé pour commencer. Vous recevez un email, et la relance vous attend sur le tableau de
                    bord (« Relances à valider ») et sur la fiche du prospect, rubrique Relances.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="radio"
                  name="autonomy"
                  value="AUTOPILOT"
                  defaultChecked={initial.autonomy === "AUTOPILOT"}
                  className="mt-2.5 accent-foreground"
                />
                <span>
                  Elle part seule quand Clozer est sûr de lui
                  <span className="block text-sm text-muted-foreground">
                    Les cas délicats (objection, message du prospect, doute) attendent quand même votre accord. Un
                    récapitulatif vous arrive chaque matin.
                  </span>
                </span>
              </label>
            </div>
          </Row>
        </Section>

        <Section
          id="offre"
          locked={locked}
          title="Votre offre"
          description={
            initial.offerInferredFrom
              ? `Pré-rempli par Clozer à partir de « ${initial.offerInferredFrom} ». Corrigez si besoin et enregistrez : vos relances n'en seront que plus justes.`
              : "Facultatif. Sans rien ici, Clozer se base sur vos documents ; il pré-remplit cette partie à la lecture du premier."
          }
        >
          <div className="space-y-1.5 px-5 py-4">
            <Label htmlFor="offerDescription">Ce que vous vendez</Label>
            <Textarea
              id="offerDescription"
              name="offerDescription"
              rows={3}
              defaultValue={initial.offerDescription}
              placeholder="Refonte de sites e-commerce Shopify, de l'audit à la mise en ligne, en 8 à 12 semaines."
            />
          </div>
          <div className="space-y-1.5 px-5 py-4">
            <Label htmlFor="targetCustomer">Vos clients</Label>
            <Input
              id="targetCustomer"
              name="targetCustomer"
              defaultValue={initial.targetCustomer}
              placeholder="Marques DTC de 2 à 20 M€ de CA, décision par le fondateur ou le directeur e-commerce"
            />
          </div>
          <div className="space-y-1.5 px-5 py-4">
            <Label htmlFor="valueProps">Pourquoi ils vous choisissent</Label>
            <Textarea
              id="valueProps"
              name="valueProps"
              rows={2}
              defaultValue={initial.valueProps}
              placeholder="Prix forfaitaire, taux de conversion +18 % en moyenne, une équipe dédiée"
            />
          </div>
          <div className="space-y-1.5 px-5 py-4">
            <Label htmlFor="commonObjections">Les objections que vous entendez souvent</Label>
            <Textarea
              id="commonObjections"
              name="commonObjections"
              rows={2}
              defaultValue={initial.commonObjections}
              placeholder="Trop cher par rapport à un freelance, peur de perdre le SEO, pas le bon moment"
            />
          </div>
          <Row>
            <label htmlFor="avgSalesCycleDays">Un deal se signe en général en</label>
            <Inline
              id="avgSalesCycleDays"
              name="avgSalesCycleDays"
              type="number"
              min={1}
              max={730}
              defaultValue={initial.avgSalesCycleDays}
            />
            jours
          </Row>
        </Section>

        <Section
          id="messages"
          locked={locked}
          title="Vos messages"
          description="Les relances sont écrites en votre nom : comment vous signez, et sur quel ton."
        >
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="senderName">Signé par</Label>
              <Input id="senderName" name="senderName" defaultValue={initial.senderName} placeholder="Jérôme" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aiTone">Ton</Label>
              <Input
                id="aiTone"
                name="aiTone"
                defaultValue={initial.aiTone}
                placeholder="direct, vouvoiement, sans jargon"
              />
            </div>
          </div>
          <div className="space-y-1.5 px-5 py-4">
            <Label htmlFor="senderSignature">Signature</Label>
            <Textarea
              id="senderSignature"
              name="senderSignature"
              rows={3}
              defaultValue={initial.senderSignature}
              placeholder={"Jérôme Laval\nStudio Nova, 06 12 34 56 78"}
            />
          </div>
        </Section>

        <Section
          id="alertes"
          title="Être prévenu"
          description="Seulement quand ça vaut le coup : un prospect qui répond, un bon moment pour appeler, et un point chaque matin. Ces réglages ne concernent que vous."
        >
          <Row hint="Validation ou demande d'ajustement : c'est rare, et le prospect attend votre retour.">
            <ChannelBox
              name="emailActions"
              value="on"
              label="Un email dès qu'un prospect valide ou demande un ajustement"
              defaultChecked={notifications.emailActions}
              onChange={markDirty}
            />
          </Row>
          <Row
            hint={
              notifications.extensionConnected
                ? "Extension connectée. Une notification arrive quand un prospect ouvre votre proposition pour la première fois, revient après un silence, s'attarde sur les tarifs ou la lit à plusieurs. Jamais le soir ni le week-end, 4 par heure au plus."
                : "Extension non connectée : installez-la plus bas pour recevoir une alerte pendant la lecture."
            }
          >
            <span className="mb-1 block">Quand c&apos;est le moment d&apos;appeler</span>
            <div className="flex flex-col gap-1.5">
              <ChannelBox
                name="extensionCallMoments"
                value="on"
                label="Notification de l'extension Chrome"
                defaultChecked={notifications.extensionCallMoments}
                onChange={markDirty}
              />
              <ChannelBox
                name="emailCallMoments"
                value="on"
                label="Un email aussi"
                note="si l'extension n'est pas ouverte"
                defaultChecked={notifications.emailCallMoments}
                onChange={markDirty}
              />
            </div>
          </Row>
          <Row hint="Qui recontacter aujourd'hui et pourquoi, puis les réponses et lectures de la veille. Du lundi au vendredi, rien s'il n'y a rien à dire.">
            <label className="flex cursor-pointer items-center gap-2.5">
              <Checkbox name="morningDigest" value="on" defaultChecked={notifications.morningDigest} onCheckedChange={markDirty} />
              <span>
                Un compte rendu chaque matin à
                <select
                  name="digestHour"
                  defaultValue={String(notifications.digestHour)}
                  className="mx-1.5 h-8 rounded-md border border-input bg-transparent px-2 tabular-nums"
                >
                  {DIGEST_HOURS.map((hour) => (
                    <option key={hour} value={hour}>
                      {hour} h
                    </option>
                  ))}
                </select>
              </span>
            </label>
          </Row>
          {/* Team-wide channels, in the middle of the seller's own notifications */}
          <fieldset disabled={locked} className="min-w-0 divide-y divide-border disabled:opacity-60">
            <Row hint={locked ? LOCKED_NOTE : undefined}>
              <span className="mb-1 block">Pour toute l&apos;équipe, prévenir aussi sur</span>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <ChannelBox
                  name="alertChannels"
                  value="SLACK"
                  label="Slack"
                  defaultChecked={initial.alertChannels.includes("SLACK")}
                  onChange={markDirty}
                />
                <ChannelBox
                  name="alertChannels"
                  value="WEBHOOK"
                  label="Outil externe"
                  defaultChecked={initial.alertChannels.includes("WEBHOOK")}
                  onChange={markDirty}
                />
              </div>
            </Row>
            <div className="space-y-1.5 px-5 py-4">
              <Label htmlFor="alertEmail">Mettre en copie des emails d&apos;alerte</Label>
              <Input
                id="alertEmail"
                name="alertEmail"
                type="email"
                defaultValue={initial.alertEmail}
                placeholder="Facultatif, ex. direction commerciale"
              />
            </div>
            <details className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 text-body font-medium outline-none focus-visible:underline [&::-webkit-details-marker]:hidden">
                <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
                Brancher Slack ou un outil externe
              </summary>
              <div className="mt-4 space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="slackWebhookUrl">Adresse du webhook Slack</Label>
                  <Input
                    id="slackWebhookUrl"
                    name="slackWebhookUrl"
                    type="url"
                    placeholder={
                      initial.slackConfigured
                        ? "Déjà branché, laissez vide pour le garder"
                        : "https://hooks.slack.com/services/…"
                    }
                  />
                  {initial.slackConfigured && (
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Checkbox name="removeSlack" onCheckedChange={markDirty} /> Débrancher Slack
                    </label>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="outboundWebhookUrl">Webhook (CRM, Zapier, Make…)</Label>
                  <Input
                    id="outboundWebhookUrl"
                    name="outboundWebhookUrl"
                    type="url"
                    defaultValue={initial.outboundWebhookUrl}
                    placeholder="https://…"
                  />
                  {initial.webhookSecret && (
                    <p className="text-sm text-muted-foreground">
                      Chaque envoi est signé (HMAC SHA-256, en-tête <code>X-Closing-Signature</code>) avec le secret{" "}
                      <code className="break-all text-foreground">{initial.webhookSecret}</code>
                    </p>
                  )}
                </div>
              </div>
            </details>
          </fieldset>
        </Section>
      </div>

      <div
        className={cn(
          "sticky bottom-20 z-20 mt-10 flex items-center justify-between gap-4 rounded-xl bg-foreground py-2.5 pr-2.5 pl-5 text-background shadow-lg transition-all duration-200 sm:bottom-6 motion-reduce:transition-none",
          dirty || pending ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
        )}
        aria-hidden={!(dirty || pending)}
      >
        <span className="text-body">Modifications non enregistrées</span>
        <Button type="submit" variant="secondary" size="lg" disabled={pending} tabIndex={dirty || pending ? 0 : -1}>
          {pending ? "Enregistrement…" : "Enregistrer les réglages"}
        </Button>
      </div>
    </form>
  );
}
