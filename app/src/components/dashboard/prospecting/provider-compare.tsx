import { useTranslations } from "next-intl";

import type { ProviderMetrics } from "@/lib/prospecting/metrics";

import { providerLabel } from "./labels";

/** Same target, side by side: who finds decision makers, who gives emails that work, at what cost. */
export function ProviderCompare({ metrics }: { metrics: ProviderMetrics[] }) {
  const t = useTranslations("prospecting.providerCompare");
  const tl = useTranslations("prospecting.labels");
  const percent = (value: number | null) => (value === null ? "—" : t("percent", { value: Math.round(value * 100) }));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-small" aria-label={t("label")}>
        <thead className="text-left text-micro text-muted-foreground">
          <tr className="border-b border-foreground">
            <th scope="col" className="sticky left-0 bg-card px-5 py-2 font-normal">{t("provider")}</th>
            <th scope="col" className="px-3 py-2 font-normal">{t("found")}</th>
            <th scope="col" className="px-3 py-2 font-normal">{t("decisionMakers")}</th>
            <th scope="col" className="px-3 py-2 font-normal">{t("verifiedCompany")}</th>
            <th scope="col" className="px-3 py-2 font-normal">{t("validEmails")}</th>
            <th scope="col" className="px-3 py-2 font-normal">{t("credits")}</th>
            <th scope="col" className="px-5 py-2 font-normal">{t("perDelivered")}</th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {metrics.map((m) => (
            <tr key={m.provider} className="border-b border-border last:border-0">
              <th scope="row" className="sticky left-0 bg-card px-5 py-2.5 text-left font-sans font-semibold">
                {providerLabel(tl, m.provider)}
              </th>
              <td className="px-3 py-2">{m.found}</td>
              <td className="px-3 py-2">{percent(m.decisionMakerRate)}</td>
              <td className="px-3 py-2">{percent(m.verifiedCompanyRate)}</td>
              <td className="px-3 py-2">
                {percent(m.validEmailRate)}
                {m.revealed > 0 && <span className="text-muted-foreground"> ({m.revealed})</span>}
              </td>
              <td className="px-3 py-2">{m.creditsSpent}</td>
              <td className="px-5 py-2">{m.creditsPerDelivered === null ? "—" : m.creditsPerDelivered.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
