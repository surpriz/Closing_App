"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  connectMailbox,
  detectMailbox,
  disconnectMailbox,
  getDkimProbeAddress,
  recheckDns,
  saveMailboxCap,
  type MailboxFormState,
} from "@/app/(dashboard)/settings/mailbox-actions";
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
};

type DnsState = "ok" | "missing" | "unknown";

function dnsStates(dns: DnsReport | null): { key: "spf" | "dkim" | "dmarc"; state: DnsState; issue: string | null }[] {
  if (!dns) {
    return [
      { key: "spf", state: "unknown", issue: null },
      { key: "dkim", state: "unknown", issue: null },
      { key: "dmarc", state: "unknown", issue: null },
    ];
  }
  const spf: DnsState = dns.spf.status === "ok" ? "ok" : dns.spf.status === "unknown_provider" ? "unknown" : "missing";
  const dkim: DnsState = dns.dkim.status === "verified" ? "ok" : dns.dkim.status === "revoked" ? "missing" : "unknown";
  const dmarc: DnsState = dns.dmarc.status === "ok" ? "ok" : "missing";
  return [
    { key: "spf", state: spf, issue: spf === "missing" ? dns.spf.status : null },
    { key: "dkim", state: dkim, issue: dkim === "ok" ? null : dns.dkim.status },
    { key: "dmarc", state: dmarc, issue: dmarc === "missing" ? dns.dmarc.status : null },
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

function MailboxItem({ mailbox, maxCap }: { mailbox: MailboxRow; maxCap: number }) {
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
          <Badge variant={mailbox.status === "ACTIVE" ? "success" : mailbox.status === "ERROR" ? "destructive" : "secondary"}>
            {t(`status.${mailbox.status}`)}
          </Badge>
        </div>
        <DisconnectButton id={mailbox.id} />
      </div>
      {mailbox.status === "ERROR" && mailbox.lastError && (
        <p className="text-small text-destructive">{mailbox.lastError}</p>
      )}
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

function ConnectForm() {
  const t = useTranslations("settings.mailbox");
  const [form, setForm] = useState(EMPTY_FORM);
  const [detection, setDetection] = useState<MailboxDetection | null>(null);
  const [detectedFor, setDetectedFor] = useState("");
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
  const blocked = detection?.provider === "MICROSOFT";

  function detect() {
    const email = form.email.trim().toLowerCase();
    if (!looksLikeEmail || email === detectedFor) return;
    setDetectedFor(email);
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

  const passwordHint = detection?.hint === "app_password" ? t("appPasswordHint") : null;

  return (
    <form action={formAction} className="space-y-4 border-t border-border px-5 py-4">
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
          {detection.provider === "GOOGLE" && (
            <p className="border-l-2 border-foreground bg-muted px-3 py-2">{t("googleNotice")}</p>
          )}
          {blocked && <p className="border-l-2 border-foreground bg-muted px-3 py-2">{t("microsoftNotice")}</p>}
        </div>
      )}

      <fieldset disabled={blocked} className={cn("space-y-4", blocked && "opacity-50")}>
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
        disabled={pending || blocked || !looksLikeEmail || !form.password || !form.imapHost || !form.smtpHost}
      >
        {pending ? t("connecting") : t("connect")}
      </Button>
    </form>
  );
}

/** "Boîte mail": the seller's own IMAP/SMTP mailboxes, their DNS health and daily cap. Rendered only for the beta. */
export function MailboxSettings({ mailboxes, maxCap }: { mailboxes: MailboxRow[]; maxCap: number }) {
  const t = useTranslations("settings.mailbox");
  return (
    <section id="boite" className="scroll-mt-24 space-y-3">
      <div className="space-y-1">
        <h2 className="text-heading">{t("title")}</h2>
        <p className="text-body text-muted-foreground">{t("description")}</p>
      </div>
      <div className="border-y border-foreground bg-card">
        {mailboxes.length === 0 ? (
          <p className="px-5 py-3 text-small text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {mailboxes.map((mailbox) => (
              <MailboxItem key={mailbox.id} mailbox={mailbox} maxCap={maxCap} />
            ))}
          </ul>
        )}
        <ConnectForm />
      </div>
    </section>
  );
}
