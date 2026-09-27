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
import { cn } from "cn";

type Props = {
  initial: {
    version: string;
    defaultChannels: string[];
    hotPricingThresholdSec: number;
    inactivityDays: string;
    businessHourStart: number;
    businessHourEnd: number;
    multiViewerThreshold: number;
    reopenAfterInactivityDays: number;
    alertChannels: string[];
    alertEmail: string;
    slackConfigured: boolean;
    outboundWebhookUrl: string;
    webhookSecret: string | null;
    aiTone: string;
    senderName: string;
    senderSignature: string;
  };
  providers: { email: boolean; whatsapp: boolean; ai: string | null };
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
        <p className="text-[15px] text-muted-foreground">{description}</p>
      </div>
      <div className="divide-y divide-border rounded-xl bg-card ring-1 ring-border">{children}</div>
    </section>
  );
}

function Row({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="space-y-1.5 px-5 py-4">
      <div className="text-[15px] leading-9">{children}</div>
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
          title="Relances"
          description="Clozer relance vos prospects tout seul. Ces règles valent pour tous les liens, sauf réglage contraire sur un lien."
        >
          <Row hint="WhatsApp n'est utilisé que si le prospect a donné son numéro et son accord.">
            <span className="mb-1 block">Relancer par</span>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <ChannelBox
                name="defaultChannels"
                value="EMAIL"
                label="Email"
                defaultChecked={initial.defaultChannels.includes("EMAIL")}
                note={providers.email ? undefined : "pas encore branché"}
                onChange={markDirty}
              />
              <ChannelBox
                name="defaultChannels"
                value="WHATSAPP"
                label="WhatsApp"
                defaultChecked={initial.defaultChannels.includes("WHATSAPP")}
                note={providers.whatsapp ? undefined : "pas encore branché"}
                onChange={markDirty}
              />
            </div>
          </Row>
          <Row>
            <label htmlFor="hotPricingThresholdSec">Relancer si le prospect passe plus de</label>
            <Inline
              id="hotPricingThresholdSec"
              name="hotPricingThresholdSec"
              type="number"
              min={10}
              max={3600}
              defaultValue={initial.hotPricingThresholdSec}
            />
            secondes sur les tarifs
          </Row>
          <Row hint="Plusieurs délais possibles, séparés par une virgule.">
            <label htmlFor="inactivityDays">Relancer si le lien n&apos;est pas ouvert après</label>
            <Inline
              id="inactivityDays"
              name="inactivityDays"
              defaultValue={initial.inactivityDays}
              placeholder="3, 5"
              className="w-20"
            />
            jours
          </Row>
          <Row hint="À l'heure du prospect, jours ouvrés uniquement.">
            <label htmlFor="businessHourStart">Envoyer entre</label>
            <Inline
              id="businessHourStart"
              name="businessHourStart"
              type="number"
              min={0}
              max={23}
              defaultValue={initial.businessHourStart}
            />
            h et
            <Inline
              id="businessHourEnd"
              name="businessHourEnd"
              aria-label="Heure de fin d'envoi"
              type="number"
              min={1}
              max={24}
              defaultValue={initial.businessHourEnd}
            />
            h
          </Row>
        </Section>

        <Section
          title="Vos messages"
          description={
            providers.ai
              ? "Les relances sont rédigées pour chaque prospect, avec votre nom, votre ton et votre signature."
              : "Les relances partent à partir de modèles pré-écrits, avec votre nom et votre signature."
          }
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
          title="Alertes"
          description="Soyez prévenu tout de suite quand un prospect se réveille."
        >
          <Row>
            <label htmlFor="multiViewerThreshold">Prévenir si plus de</label>
            <Inline
              id="multiViewerThreshold"
              name="multiViewerThreshold"
              type="number"
              min={1}
              max={20}
              defaultValue={initial.multiViewerThreshold}
            />
            personnes lisent le devis en même temps
          </Row>
          <Row>
            <label htmlFor="reopenAfterInactivityDays">Prévenir si le devis est rouvert après</label>
            <Inline
              id="reopenAfterInactivityDays"
              name="reopenAfterInactivityDays"
              type="number"
              min={1}
              max={60}
              defaultValue={initial.reopenAfterInactivityDays}
            />
            jours de silence
          </Row>
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
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[15px] font-medium outline-none focus-visible:underline [&::-webkit-details-marker]:hidden">
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
        <span className="text-[15px]">Modifications non enregistrées</span>
        <Button type="submit" variant="secondary" size="lg" disabled={pending} tabIndex={dirty || pending ? 0 : -1}>
          {pending ? "Enregistrement…" : "Enregistrer les réglages"}
        </Button>
      </div>
    </form>
  );
}
