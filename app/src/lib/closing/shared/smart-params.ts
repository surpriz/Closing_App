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

export type SmartLinkTool = "lemlist" | "instantly" | "apollo" | "woodpecker" | "other";

/** Each tool's variables. Lemlist's are documented; the others are checked in the tool's editor. */
export const SMART_LINK_TOOLS: Record<
  SmartLinkTool,
  { label: string; email: string; company: string; name: string }
> = {
  lemlist: { label: "Lemlist", email: "{{email}}", company: "{{companyName}}", name: "{{firstName}}" },
  instantly: { label: "Instantly", email: "{{email}}", company: "{{companyName}}", name: "{{firstName}}" },
  apollo: { label: "Apollo", email: "{{email}}", company: "{{company}}", name: "{{first_name}}" },
  woodpecker: { label: "Woodpecker", email: "{{EMAIL}}", company: "{{COMPANY}}", name: "{{FIRST_NAME}}" },
  other: { label: "Autre", email: "{{email}}", company: "{{company}}", name: "{{firstName}}" },
};

/** The URL to paste in the sequence. Braces stay readable: the tool replaces them before sending. */
export function smartLinkUrl(baseUrl: string, tool: SmartLinkTool) {
  const tags = SMART_LINK_TOOLS[tool];
  return `${baseUrl}?email=${tags.email}&company=${tags.company}&name=${tags.name}`;
}
