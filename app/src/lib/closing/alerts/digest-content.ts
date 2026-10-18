import { INTL_LOCALE, type UiLocale } from "@/i18n/locale";
import { renderEmail, type EmailBlock } from "@/lib/email-layout";
import { getNamespaceTranslator } from "@/lib/server-translator";

import { DAY_MS } from "../constants";
import { getLocalParts } from "../scheduling/business-hours";

/**
 * The morning email: who to contact today and why, then what happened since
 * the last one. Pure, no LLM call: the "why" comes from the deal analysis or
 * the rule-based action already shown on the dashboard.
 */

export type DigestData = {
  appUrl: string;
  /** The seller's language. */
  locale: UiLocale;
  /** "hier", "vendredi"… how the period is named in the email. */
  sinceLabel: string;
  todo: { label: string; documentName: string; why: string; url: string }[];
  /** Prospect answers, and questions the assistant passed on to the seller. */
  actions: {
    label: string;
    kind: "validated" | "change" | "quote" | "extension" | "relink" | "meeting" | "question";
    message: string | null;
    url: string;
  }[];
  counts: { readers: number; followupsSent: number; followupsFailed: number; unsubscribed: number };
  /** Autopilot: follow-ups that went out without the seller reading them. */
  autoSent: { label: string; subject: string | null; url: string }[];
  drafts: number;
  /** Links locking within a day and a half. */
  expiring?: { label: string; documentName: string; when: string; url: string }[];
};

/** Beyond this, the list stops being a to-do list. */
export const DIGEST_TODO_MAX = 5;

export function digestSubject(data: DigestData) {
  const t = getNamespaceTranslator(data.locale, "alerts.digest");
  if (data.todo.length) return t("subjectTodo", { count: data.todo.length });
  if (data.actions.length) return t("subjectActions", { count: data.actions.length, since: data.sinceLabel });
  if (data.expiring?.length) return t("subjectExpiring", { count: data.expiring.length });
  if (data.autoSent.length) return t("subjectAutoSent", { count: data.autoSent.length });
  return t("subjectDrafts", { count: data.drafts });
}

export function buildDigest(data: DigestData) {
  const t = getNamespaceTranslator(data.locale, "alerts.digest");
  const todo = data.todo.slice(0, DIGEST_TODO_MAX);
  const expiring = data.expiring ?? [];
  if (!todo.length && !data.actions.length && !expiring.length && !data.autoSent.length && !data.drafts) return null;

  const blocks: EmailBlock[] = [];

  if (todo.length) {
    blocks.push({ kind: "heading", text: t("todoHeading") });
    blocks.push({
      kind: "list",
      items: todo.map((row) => ({ text: `${row.label} · ${row.documentName}`, detail: row.why, href: row.url })),
    });
  }

  if (data.actions.length) {
    blocks.push({ kind: "heading", text: t("actionsHeading", { since: data.sinceLabel }) });
    blocks.push({
      kind: "list",
      items: data.actions.map((a) => ({
        text: t(`action.${a.kind}`, { label: a.label }),
        detail: a.message
          ? t("quote", { text: a.message.length > 180 ? `${a.message.slice(0, 177)}…` : a.message })
          : undefined,
        href: a.url,
      })),
    });
  }

  if (expiring.length) {
    blocks.push({ kind: "heading", text: t("expiringHeading") });
    blocks.push({
      kind: "list",
      items: expiring.map((row) => ({
        text: `${row.label} · ${row.documentName}`,
        detail: t("expiringDetail", { when: row.when }),
        href: row.url,
      })),
    });
  }

  const facts = [
    data.counts.readers && t("facts.readers", { count: data.counts.readers }),
    data.counts.followupsSent && t("facts.followupsSent", { count: data.counts.followupsSent }),
    data.counts.followupsFailed && t("facts.followupsFailed", { count: data.counts.followupsFailed }),
    data.counts.unsubscribed && t("facts.unsubscribed", { count: data.counts.unsubscribed }),
  ].filter((fact): fact is string => !!fact);
  if (facts.length) {
    blocks.push({ kind: "heading", text: t("sinceHeading", { since: data.sinceLabel }) });
    blocks.push({ kind: "text", text: `${facts.join(", ")}.` });
  }

  if (data.autoSent.length) {
    blocks.push({ kind: "heading", text: t("autoSentHeading") });
    blocks.push({
      kind: "list",
      items: data.autoSent.map((f) => ({ text: f.label, detail: f.subject ?? t("whatsapp"), href: f.url })),
    });
  }

  if (data.drafts) {
    blocks.push({ kind: "text", text: t("draftsLine", { count: data.drafts }) });
    blocks.push({ kind: "button", label: t("reviewButton"), href: `${data.appUrl}/dashboard` });
  } else {
    blocks.push({ kind: "button", label: t("openButton"), href: `${data.appUrl}/dashboard` });
  }

  const subject = digestSubject({ ...data, todo });
  const { html, text } = renderEmail({
    locale: data.locale,
    preheader: todo.map((row) => row.label).join(", ") || undefined,
    title: subject,
    blocks,
    footer: { text: t("footer"), href: `${data.appUrl}/settings#alertes` },
  });
  return { subject, html, text };
}

/** Never look back further than this, even after a long break. */
export const MAX_LOOKBACK_MS = 7 * DAY_MS;
/** Past digestHour + this, today's digest is skipped (seller turned it on in the afternoon). */
const SEND_WINDOW_HOURS = 4;

function localDay(date: Date, timezone: string) {
  const p = getLocalParts(date, timezone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Is it time for this seller's digest, and has today's not gone out yet? Pure. */
export function isDigestDue(
  prefs: { morningDigest: boolean; digestHour: number; timezone: string },
  lastDigestAt: Date | null,
  now: Date,
) {
  if (!prefs.morningDigest) return false;
  const local = getLocalParts(now, prefs.timezone);
  if (local.weekday > 5) return false;
  if (local.hour < prefs.digestHour || local.hour >= prefs.digestHour + SEND_WINDOW_HOURS) return false;
  return !lastDigestAt || localDay(lastDigestAt, prefs.timezone) !== localDay(now, prefs.timezone);
}

/** "hier" on a normal day, the weekday name after a weekend or a gap ("vendredi", "Friday"). */
export function sinceLabel(since: Date, now: Date, timezone: string, locale: UiLocale) {
  const days = Math.round((now.getTime() - since.getTime()) / DAY_MS);
  if (days <= 1) return getNamespaceTranslator(locale, "alerts.digest")("yesterday");
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { weekday: "long", timeZone: timezone }).format(since);
}
