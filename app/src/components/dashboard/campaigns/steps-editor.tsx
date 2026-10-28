"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { saveStepsAction, sendTestAction, trackingHintAction } from "@/app/(dashboard)/campaigns/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { renderTemplate } from "@/lib/outreach/render";
import { MAX_STEPS, type StepInput, type StepIssue, unknownVariables, validateSteps } from "@/lib/outreach/steps";

type EditorStep = StepInput & { key: string };

const BASE_VARIABLES = ["firstName", "lastName", "company", "title"];
const HINT_DEBOUNCE_MS = 700;

let counter = 0;
const nextKey = () => `step-${++counter}`;

// What goes to the server: a follow-up in the same thread has no subject of its own
function toInput(steps: EditorStep[]): StepInput[] {
  return steps.map(({ order, delayDays, subject, newThread, body, carriesLink }) => ({
    order,
    delayDays: order === 1 ? 0 : delayDays,
    subject: order === 1 || newThread ? (subject ?? "") : null,
    newThread: order === 1 ? false : newThread,
    body,
    carriesLink,
  }));
}

export function StepsEditor({
  campaignId,
  initialSteps,
  extraVars,
  sampleVars,
  sampleEmail,
  canTest,
  disabled,
}: {
  campaignId: string;
  initialSteps: StepInput[];
  /** Keys of the CSV columns of the first enrolled prospect. */
  extraVars: string[];
  /** Values of the first enrolled prospect, for the preview. */
  sampleVars: Record<string, string | null> | null;
  sampleEmail: string | null;
  /** The campaign has an ACTIVE mailbox to send the test from. */
  canTest: boolean;
  disabled: boolean;
}) {
  const t = useTranslations("campaigns.steps");
  const [steps, setSteps] = useState<EditorStep[]>(() =>
    initialSteps.map((step) => ({ ...step, subject: step.subject ?? "", key: nextKey() })),
  );
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initialSteps.map(strip)));
  const [serverIssues, setServerIssues] = useState<string[]>([]);
  const [showIssues, setShowIssues] = useState(false);
  const [hints, setHints] = useState<Record<string, string | null>>({});
  const [saving, startSaving] = useTransition();
  const [testing, setTesting] = useState<string | null>(null);
  const bodyRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const hintCache = useRef(new Map<string, string | null>());

  const input = toInput(steps);
  const dirty = JSON.stringify(input) !== savedJson;
  const issues = validateSteps(input);
  const unknown = unknownVariables(input, extraVars);
  const sample = sampleVars ?? {
    email: t("sample.email"),
    firstName: t("sample.firstName"),
    lastName: t("sample.lastName"),
    company: t("sample.company"),
    title: t("sample.title"),
  };
  const variables = [
    ...BASE_VARIABLES,
    ...extraVars.filter((name) => ![...BASE_VARIABLES, "email", "link"].includes(name)),
  ];

  // The tracking check lives on the server (the guard needs the message catalog); results are cached per text
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const next: Record<string, string | null> = {};
      for (const step of steps) {
        const text = `${step.subject ?? ""}\n${step.body}`;
        if (!step.body.trim()) continue;
        if (!hintCache.current.has(text)) hintCache.current.set(text, await trackingHintAction(text));
        next[step.key] = hintCache.current.get(text) ?? null;
      }
      if (!cancelled) setHints(next);
    }, HINT_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [steps]);

  const patch = (key: string, change: Partial<EditorStep>) =>
    setSteps((current) => current.map((step) => (step.key === key ? { ...step, ...change } : step)));

  const add = () =>
    setSteps((current) =>
      current.length >= MAX_STEPS
        ? current
        : [
            ...current,
            { order: current.length + 1, delayDays: 3, subject: "", newThread: false, body: "", carriesLink: false, key: nextKey() },
          ],
    );

  const remove = (key: string) =>
    setSteps((current) => current.filter((step) => step.key !== key).map((step, index) => ({ ...step, order: index + 1 })));

  const insert = (step: EditorStep, name: string) => {
    const field = bodyRefs.current[step.key];
    const start = field?.selectionStart ?? step.body.length;
    const end = field?.selectionEnd ?? start;
    const token = `{{${name}}}`;
    patch(step.key, { body: step.body.slice(0, start) + token + step.body.slice(end) });
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const label = (issue: StepIssue) => t(`issues.${issue.code}`, { order: "order" in issue ? issue.order : 0 });

  const save = () => {
    setShowIssues(true);
    setServerIssues([]);
    if (issues.length > 0) return;
    startSaving(async () => {
      const result = await saveStepsAction(campaignId, JSON.stringify(input));
      if ("error" in result) {
        if (result.issues) setServerIssues(result.issues);
        else toast.error(result.error);
        return;
      }
      setSavedJson(JSON.stringify(input));
      setShowIssues(false);
      toast.success(result.notice);
    });
  };

  const sendTest = async (step: EditorStep) => {
    setTesting(step.key);
    try {
      const result = await sendTestAction(campaignId, step.order);
      if ("error" in result) toast.error(result.error);
      else if (result.notice) toast.success(result.notice);
    } finally {
      setTesting(null);
    }
  };

  const first = steps[0];
  const renderedFirstSubject = first ? renderTemplate(first.subject ?? "", { ...sample, link: t("linkPlaceholder") }).text : "";

  return (
    <div className="space-y-5">
      <p className="text-small text-muted-foreground">{t("description")}</p>

      <ol className="space-y-5">
        {steps.map((step) => {
          const hasSubject = step.order === 1 || step.newThread;
          const linkTaken = steps.some((other) => other.carriesLink && other.key !== step.key);
          const stepVariables = step.carriesLink ? [...variables, "link"] : variables;
          const body = renderTemplate(step.body, { ...sample, link: t("linkPlaceholder") });
          const subject = hasSubject
            ? renderTemplate(step.subject ?? "", { ...sample, link: t("linkPlaceholder") }).text
            : `Re: ${renderedFirstSubject}`;
          const hint = hints[step.key];

          return (
            <li key={step.key} className="space-y-3 bg-card p-4 ring-1 ring-foreground/85">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-body font-semibold">{t("step", { order: step.order })}</h3>
                {!disabled && steps.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("remove", { order: step.order })}
                    onClick={() => remove(step.key)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                )}
              </div>

              {step.order > 1 && (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <label className="flex items-center gap-2 text-small">
                    <span>{t("delay")}</span>
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      inputMode="numeric"
                      value={Number.isFinite(step.delayDays) ? step.delayDays : ""}
                      onChange={(event) => patch(step.key, { delayDays: event.target.valueAsNumber })}
                      disabled={disabled}
                      className="w-20"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-small">
                    <Switch
                      checked={step.newThread}
                      onCheckedChange={(checked) => patch(step.key, { newThread: checked })}
                      disabled={disabled}
                    />
                    <span>{t("newThread")}</span>
                  </label>
                </div>
              )}

              {hasSubject ? (
                <div className="space-y-1.5">
                  <label htmlFor={`${step.key}-subject`} className="text-small font-medium">
                    {t("subject")}
                  </label>
                  <Input
                    id={`${step.key}-subject`}
                    value={step.subject ?? ""}
                    maxLength={200}
                    onChange={(event) => patch(step.key, { subject: event.target.value })}
                    disabled={disabled}
                  />
                </div>
              ) : (
                <p className="text-small text-muted-foreground">{t("sameThread")}</p>
              )}

              <div className="space-y-1.5">
                <label htmlFor={`${step.key}-body`} className="text-small font-medium">
                  {t("body")}
                </label>
                <Textarea
                  id={`${step.key}-body`}
                  ref={(element) => {
                    bodyRefs.current[step.key] = element;
                  }}
                  value={step.body}
                  rows={8}
                  maxLength={5000}
                  onChange={(event) => patch(step.key, { body: event.target.value })}
                  disabled={disabled}
                />
                {!disabled && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-small text-muted-foreground">{t("variables")}</span>
                    {stepVariables.map((name) => (
                      <Button
                        key={name}
                        type="button"
                        variant="outline"
                        size="xs"
                        className="font-mono"
                        onClick={() => insert(step, name)}
                      >
                        {`{{${name}}}`}
                      </Button>
                    ))}
                  </div>
                )}
                {!disabled && step.order === 1 && (
                  <p className="text-small text-muted-foreground">{t("variablesHint", { example: "{{firstName|there}}" })}</p>
                )}
                {hint && (
                  <p role="status" className="text-small text-warning-foreground">
                    {t("trackingHint")} “{hint}”
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="flex items-center gap-2 text-small">
                  <Checkbox
                    checked={step.carriesLink}
                    onCheckedChange={(checked) => patch(step.key, { carriesLink: checked === true })}
                    disabled={disabled || (linkTaken && !step.carriesLink)}
                  />
                  <span>{t("carriesLink")}</span>
                </label>
                {linkTaken && !step.carriesLink && (
                  <p className="text-small text-muted-foreground">{t("carriesLinkTaken")}</p>
                )}
              </div>

              <details className="text-small">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{t("preview.title")}</summary>
                <div className="mt-2 space-y-2 border-l-2 border-border pl-3">
                  <p className="text-muted-foreground">
                    {sampleVars && sampleEmail ? t("preview.forProspect", { email: sampleEmail }) : t("preview.forSample")}
                  </p>
                  <p>
                    <span className="text-muted-foreground">{t("preview.subject")} </span>
                    {subject}
                  </p>
                  <pre className="font-sans text-body whitespace-pre-wrap">{body.text}</pre>
                  {sampleVars && body.missing.length > 0 && (
                    <p className="text-warning-foreground">{t("preview.missing", { names: body.missing.join(", ") })}</p>
                  )}
                </div>
              </details>

              {!disabled && (
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canTest || dirty || testing !== null}
                    onClick={() => sendTest(step)}
                  >
                    {testing === step.key ? t("test.sending") : t("test.button")}
                  </Button>
                  {dirty && <span className="text-small text-muted-foreground">{t("saveFirst")}</span>}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {unknown.length > 0 && (
        <p role="status" className="text-small text-warning-foreground">
          {t("unknown", { names: unknown.map((name) => `{{${name}}}`).join(", ") })}
        </p>
      )}

      {!disabled && (
        <div className="space-y-3">
          {((showIssues && issues.length > 0) || serverIssues.length > 0) && (
            <div role="alert" className="space-y-1 text-small text-destructive">
              <p className="font-medium">{t("issues.summary")}</p>
              <ul className="list-disc pl-5">
                {(serverIssues.length > 0 ? serverIssues : issues.map(label)).map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={add} disabled={steps.length >= MAX_STEPS}>
              {t("add")}
            </Button>
            <Button onClick={save} disabled={saving || !dirty}>
              {saving ? t("saving") : t("save")}
            </Button>
            {dirty && <span className="text-small text-muted-foreground">{t("unsaved")}</span>}
            {steps.length >= MAX_STEPS && <span className="text-small text-muted-foreground">{t("addLimit", { max: MAX_STEPS })}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function strip(step: StepInput): StepInput {
  const { order, delayDays, subject, newThread, body, carriesLink } = step;
  return { order, delayDays, subject: order === 1 || newThread ? (subject ?? "") : null, newThread, body, carriesLink };
}
