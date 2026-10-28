import { templateVariables, variablesWithoutFallback } from "./render";

export type StepInput = {
  order: number;
  delayDays: number;
  subject: string | null;
  newThread: boolean;
  body: string;
  carriesLink: boolean;
};

export type StepIssue =
  | { code: "no_steps" }
  | { code: "order"; order: number }
  | { code: "empty_body"; order: number }
  | { code: "subject_required"; order: number } // step 1, or newThread, needs a subject
  | { code: "delay"; order: number } // step 1: 0 days; others: 1..60
  | { code: "several_link_steps" }
  | { code: "link_outside_link_step"; order: number } // {{link}} in a step that does not carry it
  | { code: "too_long"; order: number };

export const MAX_STEPS = 8;
export const KNOWN_VARIABLES = ["firstName", "lastName", "company", "title", "email", "link"] as const;

const MAX_BODY = 5000;
const MAX_SUBJECT = 200;
const MAX_DELAY_DAYS = 60;

/** Everything wrong with a sequence; [] when it can be saved. */
export function validateSteps(steps: StepInput[]): StepIssue[] {
  if (steps.length === 0) return [{ code: "no_steps" }];
  const issues: StepIssue[] = [];
  if (steps.length > MAX_STEPS) issues.push({ code: "order", order: MAX_STEPS + 1 });

  const sorted = [...steps].sort((a, b) => a.order - b.order);
  sorted.forEach((step, index) => {
    if (step.order !== index + 1) issues.push({ code: "order", order: step.order });
    if (!step.body.trim()) issues.push({ code: "empty_body", order: step.order });
    const subject = step.subject?.trim() ?? "";
    if ((step.order === 1 || step.newThread) && !subject) issues.push({ code: "subject_required", order: step.order });
    const delayOk =
      step.order === 1 ? step.delayDays === 0 : Number.isInteger(step.delayDays) && step.delayDays >= 1 && step.delayDays <= MAX_DELAY_DAYS;
    if (!delayOk) issues.push({ code: "delay", order: step.order });
    if (step.body.length > MAX_BODY || (step.subject?.length ?? 0) > MAX_SUBJECT) issues.push({ code: "too_long", order: step.order });
    if (!step.carriesLink && templateVariables(`${step.subject ?? ""}\n${step.body}`).some((name) => name.toLowerCase() === "link")) {
      issues.push({ code: "link_outside_link_step", order: step.order });
    }
  });
  if (steps.filter((step) => step.carriesLink).length > 1) issues.push({ code: "several_link_steps" });
  return issues;
}

/** Variables used in the sequence that are neither built in nor among `extra` (CSV columns). Case-insensitive, distinct, in order. */
export function unknownVariables(steps: StepInput[], extra: string[] = [], { withoutFallbackOnly = false } = {}): string[] {
  const known = new Set<string>([...KNOWN_VARIABLES, ...extra].map((name) => name.toLowerCase()));
  const names = withoutFallbackOnly ? variablesWithoutFallback : templateVariables;
  const seen = new Set<string>();
  const unknown: string[] = [];
  for (const step of [...steps].sort((a, b) => a.order - b.order)) {
    for (const name of [...names(step.subject ?? ""), ...names(step.body)]) {
      const key = name.toLowerCase();
      if (known.has(key) || seen.has(key)) continue;
      seen.add(key);
      unknown.push(name);
    }
  }
  return unknown;
}

/** Same, ignoring variables that have a fallback: only these would leave a prospect stuck at send time. */
export function unknownVariablesWithoutFallback(steps: StepInput[], extra: string[] = []): string[] {
  return unknownVariables(steps, extra, { withoutFallbackOnly: true });
}

/** Order of the step that carries the link, if any. */
export function linkStep(steps: { order: number; carriesLink: boolean }[]): number | null {
  return steps.find((step) => step.carriesLink)?.order ?? null;
}
