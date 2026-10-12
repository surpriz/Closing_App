import type { ProviderMetrics } from "@/lib/prospecting/metrics";

import { PROVIDER_LABELS } from "./labels";

const percent = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)} %`);

/** Same target, side by side: who finds decision makers, who gives emails that work, at what cost. */
export function ProviderCompare({ metrics }: { metrics: ProviderMetrics[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" aria-label="Comparaison des fournisseurs sur votre cible">
        <thead className="text-left text-small text-muted-foreground">
          <tr className="border-b">
            <th scope="col" className="sticky left-0 bg-card px-5 py-2 font-normal">Fournisseur</th>
            <th scope="col" className="px-3 py-2 font-normal">Proposés</th>
            <th scope="col" className="px-3 py-2 font-normal">Décideurs</th>
            <th scope="col" className="px-3 py-2 font-normal">Entreprise confirmée</th>
            <th scope="col" className="px-3 py-2 font-normal">Emails valides</th>
            <th scope="col" className="px-3 py-2 font-normal">Crédits</th>
            <th scope="col" className="px-5 py-2 font-normal">Par contact livré</th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {metrics.map((m) => (
            <tr key={m.provider} className="border-b last:border-0">
              <th scope="row" className="sticky left-0 bg-card px-5 py-2 text-left font-sans font-medium">
                {PROVIDER_LABELS[m.provider] ?? m.provider}
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
