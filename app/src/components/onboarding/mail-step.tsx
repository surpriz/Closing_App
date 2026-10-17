import { Check, Globe, Mail, Monitor, MoreHorizontal, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { MAIL_CLIENTS, type MailClient } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

import { StepHeading } from "./parts";

const ICONS: Record<MailClient, LucideIcon> = {
  gmail: Mail,
  outlook_web: Globe,
  outlook_desktop: Monitor,
  other: MoreHorizontal,
};

export function MailStep({
  firstName,
  value,
  onChange,
}: {
  firstName: string | null;
  value: MailClient | null;
  onChange: (value: MailClient) => void;
}) {
  const t = useTranslations("onboarding.mailStep");
  const tClients = useTranslations("onboarding.mailClients");
  return (
    <div className="space-y-8">
      <StepHeading
        title={t("title")}
        lead={firstName ? t("leadWithName", { firstName }) : t("lead")}
      />
      <div role="radiogroup" aria-label={t("mailboxAria")} className="grid gap-px border-y border-foreground bg-border sm:grid-cols-2">
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
                "flex items-start gap-4 bg-card px-5 py-4 text-left transition-colors duration-150 outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:ring-inset",
                selected && "ring-2 ring-foreground ring-inset hover:bg-card",
              )}
            >
              <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 space-y-0.5">
                <span className="block text-body font-semibold">{tClients(`${client}.title`)}</span>
                <span className="block text-small text-muted-foreground">{tClients(`${client}.hint`)}</span>
              </span>
              {selected && <Check className="mt-0.5 size-4 shrink-0" aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
