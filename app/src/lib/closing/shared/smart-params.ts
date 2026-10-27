import { normalizeEmail } from "../prospects/from-recipient";

/**
 * Smart Link: a shared link put in a cold email sequence, the tool filling in
 * who it is sent to (/v/abc?email={{email}}&company={{companyName}}). Pure.
 */

const MAX_TEXT = 120;

/** A merge tag the tool left as is ({{email}}, {email}, %EMAIL%): nobody to identify. */
const UNRESOLVED = /[{}%[\]]/;

export type SmartParams = { email: string; company: string | null; name: string | null };

type Params = Record<string, string | string[] | undefined>;

function first(params: Params, ...keys: string[]) {
  for (const key of keys) {
    const value = params[key];
    const text = (Array.isArray(value) ? value[0] : value)?.trim();
    if (text) return text;
  }
  return null;
}

function text(value: string | null) {
  if (!value || UNRESOLVED.test(value)) return null;
  return value.slice(0, MAX_TEXT);
}

/** Who the cold email went to, or null when the URL does not say (or says it wrong). */
export function parseSmartParams(params: Params): SmartParams | null {
  const raw = first(params, "email");
  // A "+" left unencoded in the address reads as a space in a query string
  const email = raw && !UNRESOLVED.test(raw) ? normalizeEmail(raw.replaceAll(" ", "+")) : null;
  if (!email) return null;
  return {
    email,
    company: text(first(params, "company", "companyName")),
    name: text(first(params, "name", "firstName")),
  };
}

export type SmartLinkProblem = "personal_link" | "unresolved_tag";

/**
 * A cold email reader the link cannot name, worth telling the seller: an
 * address in the URL of a personal link (it only reads it on a Smart Link),
 * or a Smart Link whose tool left its variable as is. Null when all is well,
 * or when nothing in the URL says it came from a sequence. Pure.
 */
export function smartLinkProblem(params: Params, shared: boolean): { kind: SmartLinkProblem; tag: string | null } | null {
  const raw = first(params, "email");
  // "?email=1" is the viewer's own "Ce n'est pas moi"
  if (!raw || raw === "1") return null;
  if (UNRESOLVED.test(raw)) return shared ? { kind: "unresolved_tag", tag: raw.slice(0, 40) } : { kind: "personal_link", tag: null };
  if (shared) return null;
  return normalizeEmail(raw.replaceAll(" ", "+")) ? { kind: "personal_link", tag: null } : null;
}

export type SmartLinkTool = "lemlist" | "instantly" | "apollo" | "manyreach" | "woodpecker" | "other";

/**
 * Each tool's variables. Only Lemlist's are documented; the others are to
 * check in the tool's editor. Null: not known, left out (the email is enough).
 */
export const SMART_LINK_TOOLS: Record<
  SmartLinkTool,
  { label: string; email: string; company: string | null; name: string | null; documented: boolean }
> = {
  lemlist: { label: "Lemlist", email: "{{email}}", company: "{{companyName}}", name: "{{firstName}}", documented: true },
  instantly: { label: "Instantly", email: "{{email}}", company: "{{companyName}}", name: "{{firstName}}", documented: false },
  apollo: { label: "Apollo", email: "{{email}}", company: "{{company}}", name: "{{first_name}}", documented: false },
  // {{EMAIL}} seen replaced in a real campaign (Oct 2026); the others unknown
  manyreach: { label: "Manyreach", email: "{{EMAIL}}", company: null, name: null, documented: false },
  woodpecker: { label: "Woodpecker", email: "{{EMAIL}}", company: "{{COMPANY}}", name: "{{FIRST_NAME}}", documented: false },
  other: { label: "Autre", email: "{{email}}", company: "{{company}}", name: "{{firstName}}", documented: false },
};

/** The URL to paste in the sequence. Braces stay readable: the tool replaces them before sending. */
export function smartLinkUrl(baseUrl: string, tool: SmartLinkTool) {
  const tags = SMART_LINK_TOOLS[tool];
  const extra = [tags.company && `&company=${tags.company}`, tags.name && `&name=${tags.name}`].filter(Boolean).join("");
  return `${baseUrl}?email=${tags.email}${extra}`;
}
