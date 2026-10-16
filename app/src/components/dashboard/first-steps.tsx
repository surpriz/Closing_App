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
  readyLink = null,
  action,
}: {
  hasDocument: boolean;
  /** At least one link was sent. */
  hasLink: boolean;
  hasRead: boolean;
  /** Name of the document whose link, made on drop, waits to be sent. */
  readyLink?: string | null;
  /** Button for the current step. */
  action?: React.ReactNode;
}) {
  const steps: Step[] = [
    {
      title: "Déposez un document",
      description:
        "Un devis, une facture, une présentation ou un doc technique en PDF, ou un lien Notion, Loom, Figma… Le lien à envoyer est prêt aussitôt.",
      done: hasDocument,
    },
    {
      title: readyLink ? "Envoyez votre lien" : "Envoyez le lien",
      description: readyLink
        ? `Le lien de « ${readyLink} » est déjà prêt. Collez-le dans votre email à la place de la pièce jointe : votre prospect le lit sans rien remplir.`
        : "Copiez-le dans votre email à la place de la pièce jointe. Un lien par prospect : vous saurez qui lit.",
      done: hasLink,
    },
    {
      title: "Le prospect l'ouvre",
      description:
        "Vous êtes prévenu, et vous voyez ici les pages lues et quand relancer. Pour tester, ouvrez-le dans une fenêtre privée : vos propres lectures ne comptent pas.",
      done: hasRead,
    },
  ];
  const current = steps.findIndex((step) => !step.done);
  const doneCount = steps.filter((step) => step.done).length;

  return (
    <section
      aria-label="Premiers pas"
      className="border-y border-foreground bg-card"
    >
      <div className="flex items-center justify-between gap-4 border-b border-foreground px-4 py-3">
        <p className="font-semibold">Premiers pas</p>
        <div className="flex items-center gap-3 text-small text-muted-foreground">
          <span className="font-mono tabular-nums">
            {doneCount}/{steps.length}
          </span>
          <span
            aria-hidden
            className="block h-1.5 w-24 overflow-hidden bg-foreground/[0.08]"
          >
            <span
              className="block h-full bg-foreground transition-[width] duration-500"
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
              className={cn(
                "flex gap-4 px-4 py-4",
                !isCurrent && !step.done && "opacity-60",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center font-mono text-small font-medium",
                  step.done
                    ? "bg-success text-success-foreground"
                    : isCurrent
                      ? "bg-foreground text-background"
                      : "border border-border text-muted-foreground",
                )}
              >
                {step.done ? (
                  <Check
                    className="size-4"
                    strokeWidth={2.5}
                    aria-label="Fait"
                  />
                ) : (
                  index + 1
                )}
              </span>
              <div className="min-w-0 flex-1 space-y-1 pt-0.5">
                <p
                  className={cn(
                    "font-medium",
                    step.done && "text-muted-foreground line-through",
                  )}
                >
                  {step.title}
                </p>
                {!step.done && (
                  <p className="max-w-xl text-small text-muted-foreground">
                    {step.description}
                  </p>
                )}
                {isCurrent && action && <div className="pt-2">{action}</div>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
