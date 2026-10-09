import { renderEmail, type EmailBlock } from "@/lib/email-layout";

import { DAY_MS } from "../constants";
import { getLocalParts } from "../scheduling/business-hours";

/**
 * The morning email: who to contact today and why, then what happened since
 * the last one. Pure, no LLM call: the "why" comes from the deal analysis or
 * the rule-based action already shown on the dashboard.
 */

export type DigestData = {
  appUrl: string;
  /** "hier", "vendredi"… how the period is named in the email. */
  sinceLabel: string;
  todo: { label: string; documentName: string; why: string; url: string }[];
  /** Prospect answers, and questions the assistant passed on to the seller. */
  actions: { label: string; kind: "validated" | "change" | "question"; message: string | null; url: string }[];
  counts: { readers: number; followupsSent: number; followupsFailed: number; unsubscribed: number };
  /** Autopilot: follow-ups that went out without the seller reading them. */
  autoSent: { label: string; subject: string | null; url: string }[];
  drafts: number;
};

/** Beyond this, the list stops being a to-do list. */
export const DIGEST_TODO_MAX = 5;

function plural(n: number, one: string, many: string) {
  return `${n} ${n > 1 ? many : one}`;
}

export function digestSubject(data: DigestData) {
  if (data.todo.length) return `Ce matin : ${plural(data.todo.length, "prospect", "prospects")} à recontacter`;
  if (data.actions.length) return `${plural(data.actions.length, "réponse", "réponses")} de prospects depuis ${data.sinceLabel}`;
  if (data.autoSent.length) return `Clozer a relancé ${plural(data.autoSent.length, "prospect", "prospects")} pour vous`;
  return `${plural(data.drafts, "relance attend", "relances attendent")} votre accord`;
}

export function buildDigest(data: DigestData) {
  const todo = data.todo.slice(0, DIGEST_TODO_MAX);
  if (!todo.length && !data.actions.length && !data.autoSent.length && !data.drafts) return null;

  const blocks: EmailBlock[] = [];

  if (todo.length) {
    blocks.push({ kind: "heading", text: "À faire aujourd'hui" });
    blocks.push({
      kind: "list",
      items: todo.map((row) => ({ text: `${row.label} · ${row.documentName}`, detail: row.why, href: row.url })),
    });
  }

  if (data.actions.length) {
    blocks.push({ kind: "heading", text: `Réponses depuis ${data.sinceLabel}` });
    blocks.push({
      kind: "list",
      items: data.actions.map((a) => ({
        text:
          a.kind === "validated"
            ? `${a.label} a validé`
            : a.kind === "change"
              ? `${a.label} demande un ajustement`
              : `${a.label} a posé une question`,
        detail: a.message ? `« ${a.message.length > 180 ? `${a.message.slice(0, 177)}…` : a.message} »` : undefined,
        href: a.url,
      })),
    });
  }

  const facts = [
    data.counts.readers && `${plural(data.counts.readers, "prospect a lu", "prospects ont lu")} votre proposition`,
    data.counts.followupsSent && `${plural(data.counts.followupsSent, "relance partie", "relances parties")}`,
    data.counts.followupsFailed && `${plural(data.counts.followupsFailed, "relance en échec", "relances en échec")}`,
    data.counts.unsubscribed && `${plural(data.counts.unsubscribed, "désinscription", "désinscriptions")}`,
  ].filter((fact): fact is string => !!fact);
  if (facts.length) {
    blocks.push({ kind: "heading", text: `Depuis ${data.sinceLabel}` });
    blocks.push({ kind: "text", text: `${facts.join(", ")}.` });
  }

  if (data.autoSent.length) {
    blocks.push({ kind: "heading", text: "Parties toutes seules" });
    blocks.push({
      kind: "list",
      items: data.autoSent.map((f) => ({ text: f.label, detail: f.subject ?? "Message WhatsApp", href: f.url })),
    });
  }

  if (data.drafts) {
    blocks.push({ kind: "text", text: `${plural(data.drafts, "relance attend", "relances attendent")} votre accord.` });
    blocks.push({ kind: "button", label: "Les relire", href: `${data.appUrl}/dashboard` });
  } else {
    blocks.push({ kind: "button", label: "Ouvrir Clozer", href: `${data.appUrl}/dashboard` });
  }

  const subject = digestSubject({ ...data, todo });
  const { html, text } = renderEmail({
    preheader: todo.map((row) => row.label).join(", ") || undefined,
    title: subject,
    blocks,
    footer: { text: "Régler ou couper ce compte rendu", href: `${data.appUrl}/settings#alertes` },
  });
  return { subject, html, text };
}

/** Never look back further than this, even after a long break. */
export const MAX_LOOKBACK_MS = 7 * DAY_MS;
/** Past digestHour + this, today's digest is skipped (seller turned it on in the afternoon). */
const SEND_WINDOW_HOURS = 4;
const WEEKDAY_NAMES = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

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

/** "hier" on a normal day, the weekday name after a weekend or a gap. */
export function sinceLabel(since: Date, now: Date, timezone: string) {
  const days = Math.round((now.getTime() - since.getTime()) / DAY_MS);
  if (days <= 1) return "hier";
  return WEEKDAY_NAMES[getLocalParts(since, timezone).weekday];
}
