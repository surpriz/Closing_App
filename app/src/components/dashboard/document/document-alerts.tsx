import { useLocale, useTranslations } from "next-intl";

import type { SellerAlertChannel, SellerAlertType } from "@/generated/prisma/enums";
import { formatRelative } from "@/lib/format";

export type DocumentAlert = {
  id: string;
  type: SellerAlertType;
  deal: string;
  payload: unknown;
  channels: SellerAlertChannel[];
  sentAt: Date | null;
  error: string | null;
  createdAt: Date;
};

/** Alerts Clozer raised on this document's deals, and whether they went out. */
export function DocumentAlerts({ alerts, now }: { alerts: DocumentAlert[]; now: Date }) {
  const t = useTranslations("documents.alerts");
  const tl = useTranslations("labels");
  const locale = useLocale();
  return (
    <ul className="divide-y divide-border border-y border-foreground bg-card">
      {alerts.map((alert) => {
        const payload = (alert.payload ?? {}) as {
          liveViewers?: number;
          inactiveDays?: number;
          reason?: string;
        };
        return (
          <li key={alert.id} className="flex items-start justify-between gap-4 px-3 py-3 text-small sm:px-4">
            <div className="min-w-0">
              <p className="font-medium">
                {tl(`alertType.${alert.type}`)}
                <span className="font-normal text-muted-foreground">
                  , {alert.deal}
                  {payload.reason
                    ? `, ${payload.reason.toLowerCase()}`
                    : `${payload.liveViewers ? t("liveViewers", { count: payload.liveViewers }) : ""}${payload.inactiveDays ? t("inactiveDays", { days: payload.inactiveDays }) : ""}`}
                </span>
              </p>
              <p className="text-muted-foreground">
                {alert.channels.length === 0
                  ? t("notSent")
                  : t(alert.sentAt ? "sentBy" : "notSentBy", {
                      channels: alert.channels.map((c) => tl(`alertChannel.${c}`).toLowerCase()).join(", "),
                    })}
              </p>
              {alert.error && <p className="text-destructive">{alert.error}</p>}
            </div>
            <span className="shrink-0 text-muted-foreground">{formatRelative(alert.createdAt, locale, now)}</span>
          </li>
        );
      })}
    </ul>
  );
}
