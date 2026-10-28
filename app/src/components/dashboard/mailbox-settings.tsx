"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  connectMailbox,
  detectMailbox,
  disconnectMailbox,
  getDkimProbeAddress,
  recheckDns,
  reconnectDefaults,
  saveMailboxCap,
  type MailboxFormState,
} from "@/app/(dashboard)/settings/mailbox-actions";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { DnsReport } from "@/lib/mailboxes/dns/checks";
import type { MailboxDetection } from "@/lib/mailboxes/connect";
import { cn } from "@/lib/utils";

export type MailboxRow = {
  id: string;
  email: string;
  status: "CONNECTING" | "ACTIVE" | "ERROR" | "DISCONNECTED";
  lastError: string | null;
  dailyCap: number;
  /** What today's ramp-up and caps let this mailbox send. */
  allowance: number;
  sentToday: number;
  dns: DnsReport | null;
  provider: "GOOGLE" | "MICROSOFT" | "IMAP";
  connector: "SMTP" | "GRAPH" | "UNIPILE" | "NYLAS";
};

export type ProviderAvailability = { google: "UNIPILE" | "NYLAS" | null; microsoft: boolean };

/** Where the user comes back from an OAuth round trip: `?mailbox=<flag>&code=<ConnectResult code>`. */
export type MailboxFlash = { flag: string; code: string | null };

const FLASH_FLAGS = ["connected", "pending", "cancelled", "expired", "error", "exists", "limit", "failed"] as const;
const FLASH_CODES = ["AUTH_REVOKED", "QUOTA", "RATE_LIMITED", "REJECTED", "TRANSIENT", "CONFIG", "exists", "limit"] as const;

function startHref(provider: "GOOGLE" | "MICROSOFT", email: string, mailboxId?: string) {
  const params = new URLSearchParams({ login_hint: email });
  if (mailboxId) params.set("mailboxId", mailboxId);
  return `/api/mailboxes/${provider === "GOOGLE" ? "gmail" : "microsoft"}/start?${params}`;
}

type DnsState = "ok" | "weak" | "missing" | "unknown";

function dnsStates(dns: DnsReport | null): { key: "spf" | "dkim" | "dmarc"; state: DnsState; issue: string | null }[] {
  if (!dns) {
    return [
      { key: "spf", state: "unknown", issue: null },
      { key: "dkim", state: "unknown", issue: null },
      { key: "dmarc", state: "unknown", issue: null },
    ];
  }
  // A probe-only or partial dnsDetail may lack a part: a missing part is unknown, never a crash
  const spf: DnsState = !dns.spf ? "unknown" : dns.spf.status === "ok" ? "ok" : dns.spf.status === "unknown_provider" ? "unknown" : "missing";
  const dkim: DnsState = !dns.dkim ? "unknown" : dns.dkim.status === "verified" ? "ok" : dns.dkim.status === "revoked" ? "missing" : "unknown";
  // p=none works (the record exists): neutral badge with its info line, not a "missing"
  const dmarc: DnsState = !dns.dmarc ? "unknown" : dns.dmarc.status === "ok" ? "ok" : dns.dmarc.status === "none_policy" ? "weak" : "missing";
  return [
    { key: "spf", state: spf, issue: spf === "missing" ? dns.spf.status : null },
    { key: "dkim", state: dkim, issue: dkim === "ok" || !dns.dkim ? null : dns.dkim.status },
    { key: "dmarc", state: dmarc, issue: dmarc === "missing" || dmarc === "weak" ? dns.dmarc.status : null },
  ];
}

/** A DNS lookup can only guess the DKIM selector: an email sent to the relay lets SES verify the real signature. */
function DkimProbe({ mailboxId }: { mailboxId: string }) {
  const t = useTranslations("settings.mailbox.dns");
  const router = useRouter();
  const [address, setAddress] = useState<string | null>(null);
  const [asked, setAsked] = useState(false);
  const [loading, startLoading] = useTransition();
  const [refreshing, startRefreshing] = useTransition();

  // Relay off: no address, so no button either
  if (asked && !address) return null;
  if (!address) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={loading}
        onClick={() =>
          startLoading(async () => {
            setAddress(await getDkimProbeAddress(mailboxId));
            setAsked(true);
          })
        }
      >
        {t("probe.button")}
      </Button>
    );
  }
  return (
    <div className="space-y-2 text-small">
      <p className="text-muted-foreground">{t("probe.instruction")}</p>
      <code className="block break-all bg-muted px-3 py-2">{address}</code>
      <Button
        variant="outline"
        size="sm"
        disabled={refreshing}
        onClick={() => startRefreshing(() => router.refresh())}
      >
        {t("probe.refresh")}
      </Button>
    </div>
  );
}

function DnsLine({ dns, mailboxId }: { dns: DnsReport | null; mailboxId: string }) {
  const t = useTranslations("settings.mailbox.dns");
  const states = dnsStates(dns);
  const issues = states.filter((s) => s.issue && s.state !== "ok");
  return (
    <div className="space-y-1">
      <ul className="flex flex-wrap gap-1.5">
        {states.map(({ key, state }) => (
          <li key={key}>
            <Badge variant={state === "ok" ? "success" : state === "missing" ? "warning" : "secondary"}>
              {t(key)} · {t(state)}
            </Badge>
          </li>
        ))}
      </ul>
      {issues.map(({ key, issue }) => (
        <p key={key} className="text-small text-muted-foreground">
          {t(`help.${key}.${issue}` as "help.spf.missing")}
        </p>
      ))}
      {states.find((s) => s.key === "dkim")?.state === "unknown" && <DkimProbe mailboxId={mailboxId} />}
    </div>
  );
}

function DisconnectButton({ id }: { id: string }) {
  const t = useTranslations("settings.mailbox");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {t("disconnect")}
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("disconnectTitle")}</DialogTitle>
          <DialogDescription>{t("disconnectDescription")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            {t("cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await disconnectMailbox(id);
                setOpen(false);
              })
            }
          >
            {pending ? t("disconnecting") : t("disconnect")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ERROR_CODES = ["AUTH_REVOKED", "QUOTA", "RATE_LIMITED", "REJECTED", "TRANSIENT", "CONFIG", "POLICY"] as const;
type ErrorCode = (typeof ERROR_CODES)[number];

/** `lastError` is stored as "<CODE>: <detail>": the code is translated, the detail stays as the server wrote it. */
function parseLastError(value: string): { code: ErrorCode; detail: string } | null {
  const match = /^([A-Z_]+):\s*([\s\S]*)$/.exec(value);
  const code = match?.[1];
  return code && (ERROR_CODES as readonly string[]).includes(code) ? { code: code as ErrorCode, detail: match[2].trim() } : null;
}

function LastError({ value }: { value: string }) {
  const t = useTranslations("settings.mailbox.lastError");
  const parsed = parseLastError(value);
  if (!parsed) return <p className="text-small text-destructive">{value}</p>;
  return (
    <p className="text-small text-destructive">
      {t(parsed.code)}
      {parsed.detail && <span className="text-muted-foreground"> ({parsed.detail})</span>}
    </p>
  );
}

function FlashBanner({ flash }: { flash: MailboxFlash }) {
  const t = useTranslations("settings.mailbox");
  const [pendingOver, setPendingOver] = useState(false);
  const flag = (FLASH_FLAGS as readonly string[]).includes(flash.flag) ? flash.flag : null;
  const waiting = flag === "pending" && !pendingOver;
  useEffect(() => {
    if (flag !== "pending") return;
    const timer = setTimeout(() => setPendingOver(true), 60_000);
    return () => clearTimeout(timer);
  }, [flag]);
  if (!flag) return null;
  const code = (FLASH_CODES as readonly string[]).includes(flash.code ?? "") ? flash.code : null;
  const isError = flag !== "connected" && flag !== "pending";
  return (
    <div
      role={isError ? "alert" : "status"}
      className={cn("border-b border-border px-5 py-3 text-small", isError && "text-destructive")}
    >
      {waiting && <AutoRefresh intervalMs={5000} />}
      <p>{t(`flash.${flag}` as "flash.connected")}</p>
      {flag === "error" && code && (
        <p className="text-muted-foreground">{t(`errors.${code}` as "errors.CONFIG")}</p>
      )}
    </div>
  );
}

function MailboxItem({
  mailbox,
  maxCap,
  onReconnect,
}: {
  mailbox: MailboxRow;
  maxCap: number;
  onReconnect: (target: { email: string; mailboxId: string }) => void;
}) {
  const t = useTranslations("settings.mailbox");
  const [cap, setCap] = useState(String(mailbox.dailyCap));
  const [saving, startSaving] = useTransition();
  const [rechecking, startRechecking] = useTransition();
  const capNumber = Number(cap);
  const capValid = Number.isInteger(capNumber) && capNumber >= 1 && capNumber <= maxCap;
  const ramping = mailbox.allowance < Math.min(mailbox.dailyCap, maxCap);

  return (
    <li className="space-y-3 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-body font-medium">{mailbox.email}</p>
          <Badge variant="outline">{t(`providers.${mailbox.provider}`)}</Badge>
          <Badge variant={mailbox.status === "ACTIVE" ? "success" : mailbox.status === "ERROR" ? "destructive" : "secondary"}>
            {t(`status.${mailbox.status}`)}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {mailbox.status === "ERROR" &&
            (mailbox.provider === "IMAP" ? (
              <Button variant="outline" size="sm" onClick={() => onReconnect({ email: mailbox.email, mailboxId: mailbox.id })}>
                {t("reconnect")}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                render={<a href={startHref(mailbox.provider, mailbox.email, mailbox.id)} />}
                nativeButton={false}
              >
                {t("reconnect")}
              </Button>
            ))}
          <DisconnectButton id={mailbox.id} />
        </div>
      </div>
      {mailbox.status === "ERROR" && mailbox.lastError && <LastError value={mailbox.lastError} />}
      <DnsLine dns={mailbox.dns} mailboxId={mailbox.id} />
      <Button
        variant="outline"
        size="sm"
        disabled={rechecking}
        onClick={() => startRechecking(async () => void (await recheckDns(mailbox.id)))}
      >
        {rechecking ? t("rechecking") : t("recheck")}
      </Button>
      <div className="space-y-1">
        <p className="text-small text-muted-foreground">
          {t("sentToday", { sent: mailbox.sentToday, allowance: mailbox.allowance })}
          {ramping && ` · ${t("ramping")}`}
        </p>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!capValid) return;
            startSaving(async () => {
              await saveMailboxCap(mailbox.id, capNumber);
              toast.success(t("capSaved"));
            });
          }}
        >
          <label htmlFor={`cap-${mailbox.id}`} className="text-small">
            {t("cap")}
          </label>
          <Input
            id={`cap-${mailbox.id}`}
            type="number"
            inputMode="numeric"
            min={1}
            max={maxCap}
            value={cap}
            onChange={(event) => setCap(event.target.value)}
            aria-invalid={!capValid}
            className="w-24"
          />
          <Button type="submit" size="sm" variant="outline" disabled={!capValid || saving || capNumber === mailbox.dailyCap}>
            {t("save")}
          </Button>
          <span className="text-small text-muted-foreground">{t("capHint", { max: maxCap })}</span>
        </form>
      </div>
    </li>
  );
}

const EMPTY_FORM = {
  email: "",
  displayName: "",
  user: "",
  password: "",
  imapHost: "",
  imapPort: "993",
  imapSecure: true,
  smtpHost: "",
  smtpPort: "465",
  smtpSecure: true,
};

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-small font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

/** `prefill` (a mailbox to reconnect) arrives through a remount: the password is always asked again. */
function ConnectForm({
  prefill,
  availability,
}: {
  prefill: { email: string; mailboxId: string } | null;
  availability: ProviderAvailability;
}) {
  const t = useTranslations("settings.mailbox");
  const [form, setForm] = useState({ ...EMPTY_FORM, email: prefill?.email ?? "" });
  const formRef = useRef<HTMLFormElement>(null);
  const [detection, setDetection] = useState<MailboxDetection | null>(null);
  const [detectedFor, setDetectedFor] = useState(prefill?.email.trim().toLowerCase() ?? "");
  const [detecting, startDetecting] = useTransition();
  const set = <K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const [state, formAction, pending] = useActionState<MailboxFormState, FormData>(async (prev, formData) => {
    const result = await connectMailbox(prev, formData);
    if (result && "ok" in result) {
      setForm(EMPTY_FORM);
      setDetection(null);
      setDetectedFor("");
      toast.success(t("connected"));
    }
    return result;
  }, null);

  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const microsoft = detection?.provider === "MICROSOFT";
  const googleOauth = detection?.provider === "GOOGLE" && !!availability.google;
  const [showImap, setShowImap] = useState(false);
  // Microsoft has no IMAP path; Google gets the app-password form only on request when OAuth is available.
  const imapVisible = !microsoft && (!googleOauth || showImap);

  function detect() {
    const email = form.email.trim().toLowerCase();
    if (!looksLikeEmail || email === detectedFor) return;
    setDetectedFor(email);
    runDetection(email);
  }

  function runDetection(email: string) {
    startDetecting(async () => {
      const found = await detectMailbox(email);
      setDetection(found);
      if (found?.suggested) {
        const { imap, smtp } = found.suggested;
        setForm((current) => ({
          ...current,
          imapHost: imap.host,
          imapPort: String(imap.port),
          imapSecure: imap.secure,
          smtpHost: smtp.host,
          smtpPort: String(smtp.port),
          smtpSecure: smtp.secure,
        }));
      }
    });
  }

  useEffect(() => {
    if (!prefill) return;
    const email = prefill.email.trim().toLowerCase();
    // The stored settings first: a fresh detection would blank custom hosts. Detection only when there are none
    startDetecting(async () => {
      const stored = await reconnectDefaults(prefill.mailboxId).catch(() => null);
      if (!stored) return runDetection(email);
      setForm((current) => ({
        ...current,
        displayName: stored.displayName ?? current.displayName,
        user: stored.user.trim().toLowerCase() === email ? "" : stored.user,
        imapHost: stored.imap.host,
        imapPort: String(stored.imap.port),
        imapSecure: stored.imap.secure,
        smtpHost: stored.smtp.host,
        smtpPort: String(stored.smtp.port),
        smtpSecure: stored.smtp.secure,
      }));
    });
    formRef.current?.scrollIntoView({ block: "center" });
    formRef.current?.querySelector<HTMLInputElement>("#mailbox-password")?.focus();
    // Once per prefill: the form is remounted for each one
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const userDiffers = !!form.user.trim() && form.user.trim().toLowerCase() !== form.email.trim().toLowerCase();
  const passwordHint = detection?.hint === "app_password" ? t("appPasswordHint") : null;

  return (
    <form ref={formRef} action={formAction} className="space-y-4 border-t border-border px-5 py-4">
      <p className="text-body font-semibold">{t("connectTitle")}</p>

      <Field label={t("email")} htmlFor="mailbox-email">
        <div className="flex gap-2">
          <Input
            id="mailbox-email"
            name="email"
            type="email"
            autoComplete="off"
            value={form.email}
            onChange={(event) => set("email", event.target.value)}
            onBlur={detect}
          />
          <Button type="button" variant="outline" disabled={!looksLikeEmail || detecting} onClick={detect}>
            {detecting ? t("detecting") : t("detect")}
          </Button>
        </div>
      </Field>

      {detection && (
        <div className="space-y-2 text-small" aria-live="polite">
          <p className="text-muted-foreground">
            {t("detected", { provider: t(`providers.${detection.provider}`), domain: detection.domain })}
          </p>
          {detection.provider === "GOOGLE" && !googleOauth && (
            <p className="border-l-2 border-foreground bg-muted px-3 py-2">{t("googleNotice")}</p>
          )}
          {(microsoft || googleOauth) && (
            <div className="space-y-2">
              <Button
                type="button"
                disabled={!looksLikeEmail || (microsoft && !availability.microsoft)}
                render={looksLikeEmail ? <a href={startHref(microsoft ? "MICROSOFT" : "GOOGLE", form.email.trim())} /> : undefined}
                nativeButton={false}
              >
                {microsoft ? t("oauth.microsoft") : t("oauth.google")}
              </Button>
              {microsoft && !availability.microsoft && (
                <p className="border-l-2 border-foreground bg-muted px-3 py-2">{t("microsoftNotice")}</p>
              )}
              {googleOauth && (
                <p>
                  <button type="button" className="underline" onClick={() => setShowImap((v) => !v)}>
                    {t("oauth.appPassword")}
                  </button>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {imapVisible && (
      <>
      <fieldset className="space-y-4">
        <Field label={t("displayName")} htmlFor="mailbox-name">
          <Input
            id="mailbox-name"
            name="displayName"
            autoComplete="off"
            value={form.displayName}
            onChange={(event) => set("displayName", event.target.value)}
          />
        </Field>

        <details className="space-y-3 text-small">
          <summary className="cursor-pointer text-body">{t("servers")}</summary>
          <p className="pt-2 text-muted-foreground">{t("secureHelp")}</p>
          <div className="grid gap-3 pt-2 sm:grid-cols-[1fr_6rem_auto]">
            <Field label={t("imapHost")} htmlFor="mailbox-imap-host">
              <Input id="mailbox-imap-host" name="imapHost" value={form.imapHost} onChange={(e) => set("imapHost", e.target.value)} />
            </Field>
            <Field label={t("port")} htmlFor="mailbox-imap-port">
              <Input id="mailbox-imap-port" name="imapPort" type="number" min={1} max={65535} value={form.imapPort} onChange={(e) => set("imapPort", e.target.value)} />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2">
              <input type="checkbox" name="imapSecure" checked={form.imapSecure} onChange={(e) => set("imapSecure", e.target.checked)} className="accent-foreground" />
              {t("secure")}
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_6rem_auto]">
            <Field label={t("smtpHost")} htmlFor="mailbox-smtp-host">
              <Input id="mailbox-smtp-host" name="smtpHost" value={form.smtpHost} onChange={(e) => set("smtpHost", e.target.value)} />
            </Field>
            <Field label={t("port")} htmlFor="mailbox-smtp-port">
              <Input id="mailbox-smtp-port" name="smtpPort" type="number" min={1} max={65535} value={form.smtpPort} onChange={(e) => set("smtpPort", e.target.value)} />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2">
              <input type="checkbox" name="smtpSecure" checked={form.smtpSecure} onChange={(e) => set("smtpSecure", e.target.checked)} className="accent-foreground" />
              {t("secure")}
            </label>
          </div>
        </details>

        <Field label={t("user")} htmlFor="mailbox-user">
          <Input
            id="mailbox-user"
            name="user"
            autoComplete="off"
            placeholder={form.email.trim() || undefined}
            value={form.user}
            onChange={(event) => set("user", event.target.value)}
          />
          {userDiffers && (
            <p className="border-l-2 border-foreground bg-muted px-3 py-2 text-small">
              {t("form.userDiffers", { email: form.email.trim().toLowerCase() })}
            </p>
          )}
        </Field>

        <Field label={t("password")} htmlFor="mailbox-password">
          <Input
            id="mailbox-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={form.password}
            onChange={(event) => set("password", event.target.value)}
          />
          {passwordHint && <p className="text-small text-muted-foreground">{passwordHint}</p>}
        </Field>
      </fieldset>

      {state && "error" in state && (
        <p role="alert" className="text-small text-destructive">
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        disabled={pending || !looksLikeEmail || !form.password || !form.imapHost || !form.smtpHost}
      >
        {pending ? t("connecting") : t("connect")}
      </Button>
      </>
      )}
    </form>
  );
}

/** "Boîte mail": the seller's own IMAP/SMTP mailboxes, their DNS health and daily cap. Rendered only for the beta. */
export function MailboxSettings({
  mailboxes,
  maxCap,
  availability,
  flash,
}: {
  mailboxes: MailboxRow[];
  maxCap: number;
  availability: ProviderAvailability;
  flash: MailboxFlash | null;
}) {
  const t = useTranslations("settings.mailbox");
  const [reconnect, setReconnect] = useState<{ email: string; mailboxId: string; n: number } | null>(null);
  return (
    <section id="boite" className="scroll-mt-24 space-y-3">
      <div className="space-y-1">
        <h2 className="text-heading">{t("title")}</h2>
        <p className="text-body text-muted-foreground">{t("description")}</p>
      </div>
      <div className="border-y border-foreground bg-card">
        {flash && <FlashBanner flash={flash} />}
        {mailboxes.length === 0 ? (
          <p className="px-5 py-3 text-small text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {mailboxes.map((mailbox) => (
              <MailboxItem
                key={mailbox.id}
                mailbox={mailbox}
                maxCap={maxCap}
                onReconnect={(target) => setReconnect((current) => ({ ...target, n: (current?.n ?? 0) + 1 }))}
              />
            ))}
          </ul>
        )}
        <ConnectForm
          key={reconnect?.n ?? 0}
          availability={availability}
          prefill={reconnect ? { email: reconnect.email, mailboxId: reconnect.mailboxId } : null}
        />
      </div>
    </section>
  );
}
