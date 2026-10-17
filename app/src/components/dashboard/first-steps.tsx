import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

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
  readyLinks = 0,
  action,
}: {
  hasDocument: boolean;
  /** At least one link was sent. */
  hasLink: boolean;
  hasRead: boolean;
  /** Links made on drop and waiting to be sent, listed under "À envoyer". */
  readyLinks?: number;
  /** Button for the current step. */
  action?: React.ReactNode;
}) {
  const t = useTranslations("onboarding.firstSteps");
  const steps: Step[] = [
    {
      title: t("dropTitle"),
      description: t("dropBody"),
      done: hasDocument,
    },
    {
      title: readyLinks > 1 ? t("sendMany") : readyLinks === 1 ? t("sendOne") : t("send"),
      description: readyLinks
        ? readyLinks > 1
          ? t("sendManyBody")
          : t("sendOneBody")
        : t("sendBody"),
      done: hasLink,
    },
    {
      title: t("readTitle"),
      description: t("readBody"),
      done: hasRead,
    },
  ];
  const current = steps.findIndex((step) => !step.done);
  const doneCount = steps.filter((step) => step.done).length;

  return (
    <section
      aria-label={t("title")}
      className="border-y border-foreground bg-card"
    >
      <div className="flex items-center justify-between gap-4 border-b border-foreground px-4 py-3">
        <p className="font-semibold">{t("title")}</p>
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
                    aria-label={t("done")}
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
