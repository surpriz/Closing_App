export type TemplateVars = Record<string, string | null | undefined>;

const VARIABLE = /\{\{\s*([\w-]+)\s*(?:\|([^}]*))?\}\}/g;

function lookup(vars: TemplateVars, name: string) {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(vars)) {
    if (key.toLowerCase() === wanted) return value?.trim() ? value : null;
  }
  return null;
}

/** `{{firstName|there}}`, `{{company}}`, keys case-insensitive, spaces around allowed. `{{link}}` is reserved: left as is when `vars.link` is absent. */
export function renderTemplate(body: string, vars: TemplateVars): { text: string; missing: string[] } {
  const missing: string[] = [];
  const text = body.replace(VARIABLE, (whole, name: string, fallback: string | undefined) => {
    const value = lookup(vars, name);
    if (value !== null) return value;
    if (name.toLowerCase() === "link") return whole;
    const repli = fallback?.trim();
    if (repli) return repli;
    if (!missing.includes(name)) missing.push(name);
    return "";
  });
  return { text, missing };
}

/** Distinct variable names in order of appearance (without fallbacks). */
export function templateVariables(body: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const match of body.matchAll(VARIABLE)) {
    const key = match[1].toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(match[1]);
  }
  return names;
}

export function threadSubject(
  step: { order: number; subject: string | null; newThread: boolean },
  threadSubject: string | null,
  rendered: string | null,
): { subject: string; sameThread: boolean } {
  if (step.order <= 1 || step.newThread || threadSubject === null) return { subject: rendered ?? "", sameThread: false };
  const subject = /^\s*(re|fwd?)\s*:/i.test(threadSubject) ? threadSubject.trim() : `Re: ${threadSubject}`;
  return { subject, sameThread: true };
}
