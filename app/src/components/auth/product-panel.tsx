import { useTranslations } from "next-intl";

import { HeatScale, ThermalPlate } from "@/components/brand/thermal-plate";

// Example rows, labelled as such: what tomorrow morning looks like.
const ROWS = [
  { key: "morel", name: "Atelier Morel", heat: [0.3, 0.5, 0.7, 1, 0.4, 0] },
  { key: "verso", name: "Verso Studio", heat: [0.4, 0.55, 0.5, 0.45, 0.6, 0.1] },
  { key: "brunet", name: "Brunet & Fils", heat: [0.3, 0.05, 0, 0, 0, 0] },
] as const;

/** Right half of the login screen: the morning report the seller gets, drawn in HTML. */
export function ProductPanel() {
  const t = useTranslations("auth.productPanel");
  return (
    <aside
      aria-label={t("ariaLabel")}
      className="hidden border-l border-foreground bg-card lg:flex lg:flex-col lg:justify-center lg:px-12 xl:px-20"
    >
      <div className="max-w-xl">
        <p className="condensed text-title">{t("headline")}</p>
        <figure aria-hidden className="mt-10 border border-foreground">
          <div className="flex items-baseline justify-between border-b border-foreground px-4 py-2.5 text-small">
            <span className="font-semibold">{t("report")}</span>
            <span className="text-muted-foreground">{t("example")}</span>
          </div>
          <ul className="divide-y divide-border">
            {ROWS.map((row) => (
              <li key={row.name} className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-4 px-4 py-3.5">
                <span className="grid grid-cols-6 gap-px">
                  {row.heat.map((heat, i) => (
                    <ThermalPlate key={i} heat={heat} seed={i} skeleton={false} className="aspect-[3/4]" />
                  ))}
                </span>
                <span className="min-w-0">
                  <span className="block text-body font-semibold">{row.name}</span>
                  <span className="block truncate text-small text-muted-foreground">
                    {t(`rows.${row.key}.reading`)} · <span className="text-foreground">{t(`rows.${row.key}.action`)}</span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3 border-t border-foreground px-4 py-2 font-mono text-micro text-muted-foreground">
            {t("cold")} <HeatScale className="flex-1" /> {t("hot")}
          </div>
        </figure>
        <p className="mt-6 text-small text-muted-foreground">
          {t("footnote")}
        </p>
      </div>
    </aside>
  );
}
