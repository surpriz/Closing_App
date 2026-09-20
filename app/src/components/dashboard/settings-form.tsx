"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { saveWorkspaceSettings, type SettingsState } from "@/app/(dashboard)/settings/actions";
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
import { Textarea } from "@/components/ui/textarea";

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
  providers: { email: boolean; whatsapp: boolean; ai: string | null; cron: boolean };
};

function Checkbox({ name, value, label, defaultChecked }: { name: string; value: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="size-4 accent-primary" />
      {label}
    </label>
  );
}

function Status({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <span className={`shrink-0 text-xs font-medium ${ok ? "text-emerald-700" : "text-muted-foreground"}`}>
        {ok ? "Configuré" : "Non configuré"}
      </span>
    </div>
  );
}

export function SettingsForm({ initial, providers }: Props) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(saveWorkspaceSettings, null);

  useEffect(() => {
    if (state?.ok) toast.success("Paramètres enregistrés");
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-3">
      {/* Remount the fields after each save so uncontrolled inputs show stored values */}
      <div key={initial.version} className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Relances automatiques</CardTitle>
            <CardDescription>Valeurs par défaut, appliquées à tous les liens.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Canaux</Label>
              <div className="flex gap-4">
                <Checkbox name="defaultChannels" value="EMAIL" label="Email" defaultChecked={initial.defaultChannels.includes("EMAIL")} />
                <Checkbox name="defaultChannels" value="WHATSAPP" label="WhatsApp" defaultChecked={initial.defaultChannels.includes("WHATSAPP")} />
              </div>
              <p className="text-xs text-muted-foreground">WhatsApp n&apos;est utilisé que si le prospect a un numéro et a donné son accord.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="hotPricingThresholdSec">Relance à chaud après (secondes sur les tarifs)</Label>
                <Input id="hotPricingThresholdSec" name="hotPricingThresholdSec" type="number" min={10} max={3600} defaultValue={initial.hotPricingThresholdSec} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inactivityDays">Anti-ghosting : jours sans ouverture</Label>
                <Input id="inactivityDays" name="inactivityDays" defaultValue={initial.inactivityDays} placeholder="3, 5" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="businessHourStart">Envoi à partir de (heure locale du prospect)</Label>
                <Input id="businessHourStart" name="businessHourStart" type="number" min={0} max={23} defaultValue={initial.businessHourStart} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="businessHourEnd">Jusqu&apos;à</Label>
                <Input id="businessHourEnd" name="businessHourEnd" type="number" min={1} max={24} defaultValue={initial.businessHourEnd} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rédaction des messages</CardTitle>
            <CardDescription>Guide l&apos;IA pour qu&apos;elle écrive comme vous.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="senderName">Nom de l&apos;expéditeur</Label>
                <Input id="senderName" name="senderName" defaultValue={initial.senderName} placeholder="Jérôme" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="aiTone">Ton</Label>
                <Input id="aiTone" name="aiTone" defaultValue={initial.aiTone} placeholder="direct, vouvoiement, sans jargon" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="senderSignature">Signature email</Label>
              <Textarea id="senderSignature" name="senderSignature" rows={3} defaultValue={initial.senderSignature} placeholder={"Jérôme Laval\nStudio Nova · 06 12 34 56 78"} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertes hot lead</CardTitle>
            <CardDescription>Prévenu tout de suite quand un prospect se réveille.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="multiViewerThreshold">Alerte si lecteurs simultanés &gt;</Label>
                <Input id="multiViewerThreshold" name="multiViewerThreshold" type="number" min={1} max={20} defaultValue={initial.multiViewerThreshold} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reopenAfterInactivityDays">Alerte si réouverture après (jours)</Label>
                <Input id="reopenAfterInactivityDays" name="reopenAfterInactivityDays" type="number" min={1} max={60} defaultValue={initial.reopenAfterInactivityDays} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Canaux d&apos;alerte</Label>
              <div className="flex gap-4">
                <Checkbox name="alertChannels" value="EMAIL" label="Email" defaultChecked={initial.alertChannels.includes("EMAIL")} />
                <Checkbox name="alertChannels" value="SLACK" label="Slack" defaultChecked={initial.alertChannels.includes("SLACK")} />
                <Checkbox name="alertChannels" value="WEBHOOK" label="Webhook" defaultChecked={initial.alertChannels.includes("WEBHOOK")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="alertEmail">Email d&apos;alerte</Label>
              <Input id="alertEmail" name="alertEmail" type="email" defaultValue={initial.alertEmail} placeholder="Par défaut : le créateur du lien" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="slackWebhookUrl">Webhook Slack</Label>
              <Input
                id="slackWebhookUrl"
                name="slackWebhookUrl"
                type="url"
                placeholder={initial.slackConfigured ? "Configuré · laisser vide pour conserver" : "https://hooks.slack.com/services/…"}
              />
              {initial.slackConfigured && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" name="removeSlack" className="size-3.5" /> Retirer le webhook Slack
                </label>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="outboundWebhookUrl">Webhook (CRM, Zapier, Make…)</Label>
              <Input id="outboundWebhookUrl" name="outboundWebhookUrl" type="url" defaultValue={initial.outboundWebhookUrl} placeholder="https://…" />
              {initial.webhookSecret && (
                <p className="text-xs text-muted-foreground">
                  Signature HMAC SHA-256 dans l&apos;en-tête <code>X-Closing-Signature</code>, secret :{" "}
                  <code className="break-all">{initial.webhookSecret}</code>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Connexions</CardTitle>
          <CardDescription>Configurées via les variables d&apos;environnement.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Status ok={providers.email} label="Email" hint="Envoi des relances et alertes" />
          <Status ok={providers.whatsapp} label="WhatsApp (Twilio)" hint="Relances WhatsApp" />
          <Status ok={!!providers.ai} label="IA" hint={providers.ai ?? "Sinon : messages modèles"} />
          <Status ok={providers.cron} label="Moteur planifié" hint="CRON_SECRET pour Trigger.dev" />
        </CardContent>
      </Card>
    </form>
  );
}
