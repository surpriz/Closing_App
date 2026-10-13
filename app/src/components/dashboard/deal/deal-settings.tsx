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
}: {
  /** "Email demandé", "Expire dans 15 j"… */
  summary: string[];
  name: string;
  panel: Omit<ComponentProps<typeof LinkSettingsDialog>, "name">;
  /** The welcome message control, null when the link has none to offer. */
  welcome: React.ReactNode;
  /** Page capsules recorded before the welcome message, null when there are none. */
  capsules: React.ReactNode;
}) {
  return (
    <DealSection
      id="reglages"
      title="Réglages du lien"
      hint="ce que voit le prospect"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-border py-3">
        <p className="text-small text-muted-foreground">
          {summary.join(" · ")}
        </p>
        <LinkSettingsDialog name={name} {...panel} />
      </div>
      {welcome && (
        <DealFold
          id="mot-accueil"
          title="Mot d'accueil"
          hint="le prospect le voit dès l'ouverture"
        >
          {welcome}
        </DealFold>
      )}
      {capsules && (
        <DealFold
          id="capsules"
          title="Capsules par page"
          hint="enregistrées avant le mot d'accueil"
        >
          {capsules}
        </DealFold>
      )}
    </DealSection>
  );
}
