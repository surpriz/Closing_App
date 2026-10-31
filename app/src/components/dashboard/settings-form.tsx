"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  saveWorkspaceSettings,
  type SettingsState,
} from "@/app/(dashboard)/settings/actions";
import { openUpgrade } from "@/components/billing/upgrade-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OFFER_DESCRIPTION_MAX } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

import {
  AdvancedSettingsBlock,
  AdvancedSettingsToggle,
  useAdvancedSettings,
} from "./settings-advanced";

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
    chatEnabledByDefault: boolean;
    voiceCommentsByDefault: boolean;
    followupsByDefault: boolean;
    quoteExpiryDays: number | null;
    assistantKnowledge: string;
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
    extensionConnected: { chrome: boolean; outlook: boolean };
    /** The seller's own booking page, offered on their links. */
    bookingUrl: string;
  };
  providers: { email: boolean; ai: string | null };
  /** Owners and admins set the workspace; everyone sets their own notifications. */
  canEditWorkspace: boolean;
};

const DIGEST_HOURS = [6, 7, 8, 9, 10];

const QUOTE_EXPIRY_CHOICES = [7, 15, 30];

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
  const t = useTranslations("settings.form");
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <div className="space-y-1">
        <h2 className="text-heading">{title}</h2>
        <p className="text-body text-muted-foreground">{description}</p>
        {locked && (
          <p className="text-small text-muted-foreground">{t("lockedNote")}</p>
        )}
      </div>
      <fieldset
        disabled={locked}
        className="min-w-0 divide-y divide-border border-y border-foreground bg-card disabled:opacity-60"
      >
        {children}
      </fieldset>
    </section>
  );
}

function Row({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5 px-5 py-4">
      <div className="text-body leading-9">{children}</div>
      {hint && <p className="text-small text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** A number typed inside a sentence: "après [90] secondes". */
function Inline({ className, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      className={cn(
        "mx-1 inline-flex h-8 w-16 [appearance:textfield] text-center tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        className,
      )}
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
      <Checkbox
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        onCheckedChange={onChange}
      />
      <span>{label}</span>
      {note && <span className="text-small text-muted-foreground">{note}</span>}
    </label>
  );
}

export function SettingsForm({
  initial,
  notifications,
  providers,
  canEditWorkspace,
}: Props) {
  const t = useTranslations("settings.form");
  const locked = !canEditWorkspace;
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    saveWorkspaceSettings,
    null,
  );
  // Tied to the saved version: a successful save changes it, which clears the flag.
  const [dirtyVersion, setDirtyVersion] = useState<string | null>(null);
  const dirty = dirtyVersion === initial.version;
  const markDirty = () => setDirtyVersion(initial.version);

  // The seller's time zone, for the morning digest hour
  const timezoneRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (timezoneRef.current)
      timezoneRef.current.value =
        Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, []);

  // Leaving with changes not saved: the browser asks first
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const { setOpen: setAdvancedOpen } = useAdvancedSettings();
  // Rules only the server knows (a Slack address, a safe webhook) can reject a folded field: show the fold
  useEffect(() => {
    if (state?.ok) toast.success(t("saved"));
    if (state?.upgrade && state.error) {
      openUpgrade({ error: state.error, upgrade: state.upgrade });
    } else if (state?.error) {
      toast.error(state.error);
      if (state.workspace) {
        setAdvancedOpen(true);
        // Slack and the webhook sit in their own fold under the alerts: open it too
        document.querySelectorAll<HTMLDetailsElement>("#alertes details").forEach((fold) => (fold.open = true));
      }
    }
  }, [state, t, setAdvancedOpen]);
  // Several hidden invalid fields fire one "invalid" each: point at the first only
  const reporting = useRef(false);

  return (
    <form
      action={formAction}
      onInput={markDirty}
      onChange={markDirty}
      // An invalid field in a closed fold: open its folds, then let the browser point at it
      onInvalidCapture={(event) => {
        const field = event.target as HTMLInputElement;
        if (field.offsetParent !== null || reporting.current) return;
        reporting.current = true;
        setAdvancedOpen(true);
        for (let fold = field.closest("details"); fold; fold = fold.parentElement?.closest("details") ?? null) {
          fold.open = true;
        }
        requestAnimationFrame(() => {
          field.form?.reportValidity();
          reporting.current = false;
        });
      }}
      className="max-w-2xl"
    >
      <input ref={timezoneRef} type="hidden" name="timezone" defaultValue="" />
      {/* Remount the fields after each save so uncontrolled inputs show stored values */}
      <div key={initial.version} className="space-y-12">
        <Section
          id="pilote"
          locked={locked}
          title={t("pilot.title")}
          description={
            providers.ai
              ? t("pilot.descriptionAi")
              : t("pilot.descriptionNoAi")
          }
        >
          <Row hint={t("pilot.hint")}>
            <span className="mb-1 block">{t("pilot.question")}</span>
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
                  {t("pilot.copilot")}
                  <span className="block text-small text-muted-foreground">
                    {t("pilot.copilotHint")}
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
                  {t("pilot.autopilot")}
                  <span className="block text-small text-muted-foreground">
                    {t("pilot.autopilotHint")}
                  </span>
                </span>
              </label>
            </div>
          </Row>
          <p className="max-w-prose px-5 pb-4 text-small text-muted-foreground">
            {t("pilot.senderNote")}
          </p>
        </Section>

        <Section
          id="alertes"
          title={t("alerts.title")}
          description={t("alerts.description")}
        >
          <Row hint={t("alerts.actionsHint")}>
            <ChannelBox
              name="emailActions"
              value="on"
              label={t("alerts.actionsLabel")}
              defaultChecked={notifications.emailActions}
              onChange={markDirty}
            />
          </Row>
          <Row
            hint={
              notifications.extensionConnected.chrome ||
              notifications.extensionConnected.outlook
                ? t("alerts.callConnected", {
                    which:
                      notifications.extensionConnected.chrome &&
                      notifications.extensionConnected.outlook
                        ? "both"
                        : notifications.extensionConnected.chrome
                          ? "chrome"
                          : "outlook",
                  })
                : t("alerts.callNothingConnected")
            }
          >
            <span className="mb-1 block">{t("alerts.callQuestion")}</span>
            <div className="flex flex-col gap-1.5">
              <ChannelBox
                name="extensionCallMoments"
                value="on"
                label={t("alerts.callExtension")}
                defaultChecked={notifications.extensionCallMoments}
                onChange={markDirty}
              />
              <ChannelBox
                name="emailCallMoments"
                value="on"
                label={t("alerts.callEmail")}
                note={t("alerts.callEmailNote")}
                defaultChecked={notifications.emailCallMoments}
                onChange={markDirty}
              />
            </div>
          </Row>
          <Row hint={t("alerts.digestHint")}>
            <label className="flex cursor-pointer items-center gap-2.5">
              <Checkbox
                name="morningDigest"
                value="on"
                defaultChecked={notifications.morningDigest}
                onCheckedChange={markDirty}
              />
              <span>
                {t("alerts.digestLabel")}
                <select
                  name="digestHour"
                  defaultValue={String(notifications.digestHour)}
                  className="mx-1.5 h-8 rounded-lg border border-input bg-card px-2 tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
                >
                  {DIGEST_HOURS.map((hour) => (
                    <option key={hour} value={hour}>
                      {t("alerts.digestHour", { hour })}
                    </option>
                  ))}
                </select>
              </span>
            </label>
          </Row>
          {/* Team-wide channels, in the middle of the seller's own notifications */}
          <fieldset
            disabled={locked}
            className="min-w-0 divide-y divide-border disabled:opacity-60"
          >
            <Row hint={locked ? t("lockedNote") : undefined}>
              <span className="mb-1 block">{t("alerts.teamChannels")}</span>
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
                  label={t("alerts.externalTool")}
                  defaultChecked={initial.alertChannels.includes("WEBHOOK")}
                  onChange={markDirty}
                />
              </div>
            </Row>
            <div className="space-y-1.5 px-5 py-4">
              <Label htmlFor="alertEmail">{t("alerts.ccLabel")}</Label>
              <Input
                id="alertEmail"
                name="alertEmail"
                type="email"
                defaultValue={initial.alertEmail}
                placeholder={t("alerts.ccPlaceholder")}
              />
            </div>
            <details className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 text-body font-medium outline-none focus-visible:underline [&::-webkit-details-marker]:hidden">
                <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
                {t("alerts.connectSummary")}
              </summary>
              <div className="mt-4 space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="slackWebhookUrl">
                    {t("alerts.slackLabel")}
                  </Label>
                  <Input
                    id="slackWebhookUrl"
                    name="slackWebhookUrl"
                    // The server only takes Slack's own incoming webhooks
                    pattern="https://hooks\.slack\.com/.+"
                    type="url"
                    placeholder={
                      initial.slackConfigured
                        ? t("alerts.slackConfiguredPlaceholder")
                        : "https://hooks.slack.com/services/…"
                    }
                  />
                  {initial.slackConfigured && (
                    <label className="flex items-center gap-2 text-small text-muted-foreground">
                      <Checkbox
                        name="removeSlack"
                        onCheckedChange={markDirty}
                      />{" "}
                      {t("alerts.removeSlack")}
                    </label>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="outboundWebhookUrl">
                    {t("alerts.webhookLabel")}
                  </Label>
                  <Input
                    id="outboundWebhookUrl"
                    name="outboundWebhookUrl"
                    type="url"
                    defaultValue={initial.outboundWebhookUrl}
                    placeholder="https://…"
                  />
                  {initial.webhookSecret && (
                    <p className="text-small text-muted-foreground">
                      {t.rich("alerts.webhookSigned", {
                        code: (chunks) => <code>{chunks}</code>,
                      })}{" "}
                      <code className="break-all text-foreground">
                        {initial.webhookSecret}
                      </code>
                    </p>
                  )}
                  <p className="text-small text-muted-foreground">
                    {t.rich("alerts.smartLink", {
                      code: (chunks) => <code>{chunks}</code>,
                    })}
                  </p>
                </div>
              </div>
            </details>
          </fieldset>
        </Section>

        <Section
          id="agenda"
          title={t("agenda.title")}
          description={t("agenda.description")}
        >
          <div className="space-y-1.5 px-5 py-4">
            <Label htmlFor="bookingUrl">{t("agenda.label")}</Label>
            <Input
              id="bookingUrl"
              name="bookingUrl"
              type="text"
              inputMode="url"
              autoComplete="url"
              defaultValue={notifications.bookingUrl}
              placeholder={t("agenda.placeholder")}
            />
            <p className="text-small text-muted-foreground">
              {t("agenda.hint")}
            </p>
          </div>
        </Section>

        <div className="pt-2">
          <AdvancedSettingsToggle />
        </div>

        {/* Rendered while folded so their fields stay in the saved FormData */}
        <AdvancedSettingsBlock id="reglages-avances" className="space-y-12">
          <Section
            id="offre"
            locked={locked}
            title={t("offer.title")}
            description={
              initial.offerInferredFrom
                ? t("offer.descriptionInferred", {
                    document: initial.offerInferredFrom,
                  })
                : t("offer.description")
            }
          >
            <div className="space-y-1.5 px-5 py-4">
              <Label htmlFor="offerDescription">{t("offer.whatLabel")}</Label>
              <Textarea
                id="offerDescription"
                name="offerDescription"
                maxLength={OFFER_DESCRIPTION_MAX}
                rows={3}
                defaultValue={initial.offerDescription}
                placeholder={t("offer.whatPlaceholder")}
              />
            </div>
            <div className="space-y-1.5 px-5 py-4">
              <Label htmlFor="targetCustomer">{t("offer.customersLabel")}</Label>
              <Input
                id="targetCustomer"
                name="targetCustomer"
                maxLength={500}
                defaultValue={initial.targetCustomer}
                placeholder={t("offer.customersPlaceholder")}
              />
            </div>
            <div className="space-y-1.5 px-5 py-4">
              <Label htmlFor="valueProps">{t("offer.whyLabel")}</Label>
              <Textarea
                id="valueProps"
                name="valueProps"
                maxLength={1500}
                rows={2}
                defaultValue={initial.valueProps}
                placeholder={t("offer.whyPlaceholder")}
              />
            </div>
            <div className="space-y-1.5 px-5 py-4">
              <Label htmlFor="commonObjections">
                {t("offer.objectionsLabel")}
              </Label>
              <Textarea
                id="commonObjections"
                name="commonObjections"
                maxLength={1500}
                rows={2}
                defaultValue={initial.commonObjections}
                placeholder={t("offer.objectionsPlaceholder")}
              />
            </div>
            <Row>
              <label htmlFor="avgSalesCycleDays">
                {t("offer.cycleBefore")}
              </label>
              <Inline
                id="avgSalesCycleDays"
                name="avgSalesCycleDays"
                type="number"
                min={1}
                max={730}
                defaultValue={initial.avgSalesCycleDays}
              />
              {t("offer.cycleAfter")}
            </Row>
          </Section>

          <Section
            id="liens"
            locked={locked}
            title={t("links.title")}
            description={t("links.description")}
          >
            <Row hint={t("links.expiryHint")}>
              <span>
                {t("links.expiryLabel")}
                <select
                  name="quoteExpiryDays"
                  defaultValue={initial.quoteExpiryDays?.toString() ?? ""}
                  className="mx-1.5 h-8 rounded-lg border border-input bg-card px-2 tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
                >
                  {QUOTE_EXPIRY_CHOICES.map((days) => (
                    <option key={days} value={days}>
                      {t("links.expiryDays", { days })}
                    </option>
                  ))}
                  <option value="">{t("links.expiryNever")}</option>
                </select>
              </span>
            </Row>
            <Row>
              <label className="flex cursor-pointer items-center gap-2.5">
                <Checkbox
                  name="voiceCommentsByDefault"
                  defaultChecked={initial.voiceCommentsByDefault}
                  onCheckedChange={markDirty}
                />
                <span>{t("links.voiceComments")}</span>
              </label>
            </Row>
            <Row>
              <label className="flex cursor-pointer items-center gap-2.5">
                <Checkbox
                  name="followupsByDefault"
                  defaultChecked={initial.followupsByDefault}
                  onCheckedChange={markDirty}
                />
                <span>{t("links.followups")}</span>
              </label>
            </Row>
          </Section>

          <Section
            id="assistant"
            locked={locked}
            title={t("assistant.title")}
            description={
              providers.ai
                ? t("assistant.descriptionAi")
                : t("assistant.descriptionNoAi")
            }
          >
            <Row hint={t("assistant.enableHint")}>
              <label className="flex cursor-pointer items-center gap-2.5">
                <Checkbox
                  name="chatEnabledByDefault"
                  defaultChecked={initial.chatEnabledByDefault}
                  onCheckedChange={markDirty}
                />
                <span>{t("assistant.enableLabel")}</span>
              </label>
            </Row>
            <div className="space-y-1.5 px-5 py-4">
              <Label htmlFor="assistantKnowledge">
                {t("assistant.knowledgeLabel")}
              </Label>
              <Textarea
                id="assistantKnowledge"
                name="assistantKnowledge"
                rows={6}
                maxLength={4000}
                defaultValue={initial.assistantKnowledge}
                placeholder={t("assistant.knowledgePlaceholder")}
              />
              <p className="text-small text-muted-foreground">
                {t("assistant.knowledgeHint")}
              </p>
            </div>
          </Section>

          <Section
            id="messages"
            locked={locked}
            title={t("messages.title")}
            description={t("messages.description")}
          >
            <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="senderName">{t("messages.senderLabel")}</Label>
                <Input
                  id="senderName"
                  name="senderName"
                  maxLength={80}
                  defaultValue={initial.senderName}
                  placeholder={t("messages.senderPlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="aiTone">{t("messages.toneLabel")}</Label>
                <Input
                  id="aiTone"
                  name="aiTone"
                  maxLength={300}
                  defaultValue={initial.aiTone}
                  placeholder={t("messages.tonePlaceholder")}
                />
              </div>
            </div>
            <div className="space-y-1.5 px-5 py-4">
              <Label htmlFor="senderSignature">{t("messages.signatureLabel")}</Label>
              <Textarea
                id="senderSignature"
                name="senderSignature"
                maxLength={500}
                rows={3}
                defaultValue={initial.senderSignature}
                placeholder={t("messages.signaturePlaceholder")}
              />
            </div>
          </Section>
        </AdvancedSettingsBlock>
      </div>

      <div
        className={cn(
          "sticky bottom-20 z-20 mt-10 flex items-center justify-between gap-4 rounded-lg bg-foreground py-2.5 pr-2.5 pl-5 text-background shadow-lg transition-all duration-200 sm:bottom-6 motion-reduce:transition-none",
          dirty || pending
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0",
        )}
        aria-hidden={!(dirty || pending)}
      >
        <span className="text-body">{t("unsaved")}</span>
        <Button
          type="submit"
          variant="secondary"
          size="lg"
          disabled={pending}
          tabIndex={dirty || pending ? 0 : -1}
        >
          {pending ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}
