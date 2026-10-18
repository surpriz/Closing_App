import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";

import { LinkSettingsDialog } from "../link-settings-form";
import { DealFold, DealSection } from "./deal-section";

/**
 * What the prospect meets on the link, in one calm field: the settings in a
 * line with the button that opens them, then the seller's own recordings,
 * folded until needed.
 */
export function DealSettings({
  summary,
  name,
  panel,
  welcome,
  capsules,
  withSettings = true,
}: {
  /** "Email demandé", "Expire dans 15 j"… */
  summary: string[];
  name: string;
  panel: Omit<ComponentProps<typeof LinkSettingsDialog>, "name">;
  /** The welcome message control, null when the link has none to offer. */
  welcome: React.ReactNode;
  /** Page capsules recorded before the welcome message, null when there are none. */
  capsules: React.ReactNode;
  /** False while the share screen shows the same settings: no second copy below. */
  withSettings?: boolean;
}) {
  const t = useTranslations("deal.dealSettings");
  if (!withSettings && !welcome && !capsules) return null;
  return (
    <DealSection id="reglages" title={t("title")} hint={t("hint")}>
      {withSettings && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-border py-3">
          <p className="text-small text-muted-foreground">
            {summary.join(" · ")}
          </p>
          <LinkSettingsDialog name={name} {...panel} />
        </div>
      )}
      {welcome && (
        <DealFold
          id="mot-accueil"
          title={t("welcomeTitle")}
          hint={t("welcomeHint")}
        >
          {welcome}
        </DealFold>
      )}
      {capsules && (
        <DealFold
          id="capsules"
          title={t("capsulesTitle")}
          hint={t("capsulesHint")}
        >
          {capsules}
        </DealFold>
      )}
    </DealSection>
  );
}
