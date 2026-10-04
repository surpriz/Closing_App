import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

type Step = { title: string; description: string; done: boolean };

/**
 * First-run checklist, ticked from real data. The first step not done yet
 * is the current one and carries the action.
 */
export function FirstSteps({
  hasDocument,
  hasLink,
  hasRead,
  action,
}: {
  hasDocument: boolean;
  hasLink: boolean;
  hasRead: boolean;
  /** Button for the current step. */
  action?: React.ReactNode;
}) {
  const steps: Step[] = [
    {
      title: "Ajoutez un document",
      description: "Un devis ou une présentation en PDF, ou un lien Notion, Loom, Figma…",
      done: hasDocument,
    },
    {
      title: "Créez un lien par prospect",
      description: "Vous saurez exactement qui lit, et quand le relancer.",
      done: hasLink,
    },
    {
      title: "Envoyez-le",
      description:
        "Collez-le dans votre email à la place de la pièce jointe. Pour tester, ouvrez-le dans une fenêtre privée : vos propres lectures ne comptent pas.",
      done: hasRead,
    },
  ];
  const current = steps.findIndex((step) => !step.done);
  const doneCount = steps.filter((step) => step.done).length;

  return (
    <section aria-label="Premiers pas" className="rounded-xl bg-card shadow-xs ring-1 ring-border">
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
        <p className="font-semibold">Premiers pas</p>
        <div className="flex items-center gap-3 text-small text-muted-foreground">
          <span className="font-mono tabular-nums">
            {doneCount}/{steps.length}
          </span>
          <span aria-hidden className="block h-1.5 w-24 overflow-hidden rounded-full bg-foreground/[0.06]">
            <span
              className="block h-full rounded-full bg-success transition-[width] duration-500"
              style={{ width: `${(doneCount / steps.length) * 100}%` }}
            />
          </span>
        </div>
      </div>
      <ol className="divide-y divide-border">
        {steps.map((step, index) => {
          const isCurrent = index === current;
          return (
            <li
              key={step.title}
              aria-current={isCurrent ? "step" : undefined}
              className={cn("flex gap-4 px-5 py-4", !isCurrent && !step.done && "opacity-60")}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-small font-medium",
                  step.done
                    ? "bg-success text-success-foreground"
                    : isCurrent
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground ring-1 ring-border",
                )}
              >
                {step.done ? <Check className="size-4" strokeWidth={2.5} aria-label="Fait" /> : index + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-1 pt-0.5">
                <p className={cn("font-medium", step.done && "text-muted-foreground line-through")}>{step.title}</p>
                {!step.done && <p className="max-w-xl text-sm text-muted-foreground">{step.description}</p>}
                {isCurrent && action && <div className="pt-2">{action}</div>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
