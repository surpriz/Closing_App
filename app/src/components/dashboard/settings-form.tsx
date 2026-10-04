"use client";

import { ChevronRight } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
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
  providers: { email: boolean; ai: string | null };
};

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-[-0.01em]">{title}</h2>
        <p className="text-body text-muted-foreground">{description}</p>
      </div>
      <div className="divide-y divide-border rounded-xl bg-card ring-1 ring-border">{children}</div>
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

export function SettingsForm({ initial, providers }: Props) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(saveWorkspaceSettings, null);
  // Tied to the saved version: a successful save changes it, which clears the flag.
  const [dirtyVersion, setDirtyVersion] = useState<string | null>(null);
  const dirty = dirtyVersion === initial.version;
  const markDirty = () => setDirtyVersion(initial.version);

  useEffect(() => {
    if (state?.ok) toast.success("Réglages enregistrés");
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} onInput={markDirty} onChange={markDirty} className="max-w-2xl">
      {/* Remount the fields after each save so uncontrolled inputs show stored values */}
      <div key={initial.version} className="space-y-12">
        <Section
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
          title="Être prévenu"
          description="Quand un prospect se réveille, lit à plusieurs, ou qu'une relance attend votre accord."
        >
          <Row>
            <span className="mb-1 block">Prévenir par</span>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <ChannelBox
                name="alertChannels"
                value="EMAIL"
                label="Email"
                defaultChecked={initial.alertChannels.includes("EMAIL")}
                onChange={markDirty}
              />
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
            <Label htmlFor="alertEmail">Envoyer les alertes à</Label>
            <Input
              id="alertEmail"
              name="alertEmail"
              type="email"
              defaultValue={initial.alertEmail}
              placeholder="Par défaut : la personne qui a créé le lien"
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
        </Section>
      </div>

      <div
        className={cn(
          "sticky bottom-20 z-20 mt-10 flex items-center justify-between gap-4 rounded-xl bg-foreground py-2.5 pr-2.5 pl-5 text-background shadow-[0_12px_32px_-12px_rgb(15_30_51/0.45)] transition-all duration-200 sm:bottom-6 motion-reduce:transition-none",
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
