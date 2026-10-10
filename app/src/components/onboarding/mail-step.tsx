import { Check, Globe, Mail, Monitor, MoreHorizontal, type LucideIcon } from "lucide-react";

import { MAIL_CLIENT_LABELS, MAIL_CLIENTS, type MailClient } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

import { StepHeading } from "./parts";

const ICONS: Record<MailClient, LucideIcon> = {
  gmail: Mail,
  outlook_web: Globe,
  outlook_desktop: Monitor,
  other: MoreHorizontal,
};

export function MailStep({ value, onChange }: { value: MailClient | null; onChange: (value: MailClient) => void }) {
  return (
    <div className="space-y-8">
      <StepHeading
        title="Vous écrivez vos emails depuis…"
        lead="Clozer se branche dessus pour remplacer vos pièces jointes par des liens, sans changer vos habitudes."
      />
      <div role="radiogroup" aria-label="Votre messagerie" className="grid gap-3 sm:grid-cols-2">
        {MAIL_CLIENTS.map((client) => {
          const Icon = ICONS[client];
          const selected = value === client;
          return (
            <button
              key={client}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(client)}
              className={cn(
                "flex items-start gap-4 rounded-xl bg-card px-5 py-4 text-left shadow-xs ring-1 ring-border transition-[box-shadow,background-color] outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/30",
                selected && "ring-2 ring-foreground hover:bg-card",
              )}
            >
              <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 space-y-0.5">
                <span className="block font-medium">{MAIL_CLIENT_LABELS[client].title}</span>
                <span className="block text-small text-muted-foreground">{MAIL_CLIENT_LABELS[client].hint}</span>
              </span>
              {selected && <Check className="mt-0.5 size-4 shrink-0" aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
