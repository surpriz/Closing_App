/**
 * Last check on a written follow-up before it can leave. Pure. Catches what
 * the prompt forbids but a model may still do: hinting that reading is
 * tracked, inventing a figure or a date, leaving a placeholder, losing the
 * link. A message with issues gets one rewrite, then falls back to a
 * template and waits for the seller.
 */

export type GuardIssue = { code: string; message: string };

export type GuardContext = {
  channel: "EMAIL" | "WHATSAPP";
  proposalUrl: string;
  /** Everything the message may quote: document text, key facts, seller description, signature. */
  sourceText: string;
};

// JS \b only knows ASCII letters: "consulté\b" never matches. A real Unicode word boundary:
const B = String.raw`(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))`;
/** A regex whose \b means a Unicode word boundary. Case-insensitive. */
const words = (pattern: RegExp, flags = "iu") => new RegExp(pattern.source.replaceAll(String.raw`\b`, B), flags);

const TRACKING_HINTS: RegExp[] = [
  // fr
  words(/\bj['’]ai (vu|remarqué|constaté|noté|aperçu)\b/),
  words(/\b(vous|tu) (avez|as) (bien )?(consulté|lu|ouvert|regardé|parcouru|feuilleté|passé du temps)\b/),
  words(/\b(vous|tu) (êtes|es) (revenu|repassé|retourné)/),
  words(/\b(vous|tu) (repassiez|repassais|reveniez|revenais|regardiez|regardais|lisiez|lisais)\b/),
  words(/\b(votre|ta) (lecture|consultation|visite)\b/),
  words(/\btemps passé\b/),
  words(/\ben train de (lire|consulter|regarder)\b/),
  // en
  words(/\bI (saw|noticed|can see|could see)\b/),
  words(/\byou(['’]ve| have)? (viewed|opened|read|spent|looked at|checked out|revisited|went back)\b/),
  words(/\b(time|minutes) (you )?spent\b/),
  words(/\byour (reading|visit)\b/),
  // es
  words(/\b(vi|he visto|noté|he notado) que\b/),
  words(/\b(has|ha|han) (abierto|leído|visto|consultado|revisado)\b/),
  // de
  words(/\b(ich habe gesehen|mir ist aufgefallen)\b/),
  words(/\b(Sie haben|du hast)\b.{0,30}\b(geöffnet|gelesen|angesehen|angeschaut)\b/),
  // any language: pointing at a page number gives the reading away
  words(/\b(page|p\.|página|seite)\s*\d+/),
];

const MONTHS =
  "janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre|january|february|march|april|may|june|july|august|september|october|november|december";
const DATE_PATTERN = new RegExp(`${B}(\\d{1,2})(?:er|st|nd|rd|th)?\\s+(${MONTHS})${B}`, "giu");
const AMOUNT_PATTERN = words(
  /(?:(?:€|\$|£)\s?\d[\d\s  .,]*\d|(?:€|\$|£)\s?\d|\d[\d\s  .,]*\d\s?(?:k€|€|eur\b|euros?\b|\$|usd\b|£|chf\b|%)|\d\s?(?:k€|€|\$|£|%))/,
  "giu",
);
const NUMBER_PATTERN = /\d[\d\s  .,]*\d|\d/gu;
const PLACEHOLDER = words(/\[[^\]\n]{2,40}\]|\{\{|\}\}|<[A-Z_]{3,}>|\bX{3,}\b|\bTODO\b/, "u");
const EMOJI = /\p{Extended_Pictographic}/u;
const MAX_LENGTH = { EMAIL: 1500, WHATSAPP: 600 } as const;

/** "12 000,00" → 12000, "1.5" → 1.5, "14,500" → 14500. Good enough to compare a figure with its source. */
export function parseNumber(raw: string): number | null {
  let text = raw.replace(/[\s  ]/g, "");
  const decimal = text.match(/[.,](\d{1,2})$/);
  if (decimal) {
    text = `${text.slice(0, -decimal[0].length).replace(/[.,]/g, "")}.${decimal[1]}`;
  } else {
    text = text.replace(/[.,]/g, "");
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function numbersIn(text: string) {
  const values = new Set<number>();
  for (const match of text.matchAll(NUMBER_PATTERN)) {
    const value = parseNumber(match[0]);
    if (value !== null) values.add(value);
  }
  return values;
}

export function lintFollowup(draft: { subject: string | null; body: string }, ctx: GuardContext): GuardIssue[] {
  const issues: GuardIssue[] = [];
  const full = `${draft.subject ?? ""}\n${draft.body}`;
  // The URL itself contains digits and "page"-like words: judge the prose without it
  const prose = full.split(ctx.proposalUrl).join(" ");

  const hint = TRACKING_HINTS.find((pattern) => pattern.test(prose));
  if (hint) {
    issues.push({
      code: "tracking_hint",
      message: `Le message laisse deviner que la lecture est suivie (« ${prose.match(hint)![0]} »).`,
    });
  }

  const urlCount = draft.body.split(ctx.proposalUrl).length - 1;
  if (urlCount !== 1) {
    issues.push({
      code: "url",
      message: urlCount === 0 ? "Le lien de la proposition manque." : "Le lien de la proposition apparaît plusieurs fois.",
    });
  }

  const known = numbersIn(ctx.sourceText);
  for (const match of prose.matchAll(AMOUNT_PATTERN)) {
    const digits = match[0].match(/\d[\d\s  .,]*\d|\d/u)?.[0];
    const value = digits ? parseNumber(digits) : null;
    const isK = /k€/iu.test(match[0]);
    if (value === null) continue;
    if (!known.has(value) && !(isK && known.has(value * 1000))) {
      issues.push({ code: "invented_figure", message: `Le montant « ${match[0].trim()} » n'apparaît pas dans la proposition.` });
    }
  }

  const sourceLower = ctx.sourceText.toLowerCase();
  for (const match of prose.matchAll(DATE_PATTERN)) {
    if (!sourceLower.includes(match[0].toLowerCase().replace(/(\d)(er|st|nd|rd|th)/, "$1"))) {
      issues.push({ code: "invented_date", message: `La date « ${match[0]} » n'apparaît pas dans la proposition.` });
    }
  }

  if (PLACEHOLDER.test(full)) {
    issues.push({ code: "placeholder", message: "Le message contient un texte à compléter." });
  }
  if (ctx.channel === "EMAIL" && EMOJI.test(full)) {
    issues.push({ code: "emoji", message: "Pas d'emoji dans un email." });
  }
  if (draft.body.length > MAX_LENGTH[ctx.channel]) {
    issues.push({ code: "length", message: "Le message est trop long." });
  }

  return issues;
}
