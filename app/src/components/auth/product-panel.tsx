import { HeatScale, ThermalPlate } from "@/components/brand/thermal-plate";

// Example rows, labelled as such: what tomorrow morning looks like.
const ROWS = [
  { name: "Atelier Morel", reading: "Tarifs relus 3 min 38", action: "Appelez maintenant", heat: [0.3, 0.5, 0.7, 1, 0.4, 0] },
  { name: "Verso Studio", reading: "Lu jusqu'au planning", action: "Relance prête à valider", heat: [0.4, 0.55, 0.5, 0.45, 0.6, 0.1] },
  { name: "Brunet & Fils", reading: "Ouvert, couverture seule", action: "Laissez-lui le temps", heat: [0.3, 0.05, 0, 0, 0, 0] },
];

/** Right half of the login screen: the morning report the seller gets, drawn in HTML. */
export function ProductPanel() {
  return (
    <aside
      aria-label="Aperçu de Clozer"
      className="hidden border-l border-foreground bg-card lg:flex lg:flex-col lg:justify-center lg:px-12 xl:px-20"
    >
      <div className="max-w-xl">
        <p className="condensed text-title">Chaque matin, votre devis à la caméra thermique.</p>
        <figure aria-hidden className="mt-10 border border-foreground">
          <div className="flex items-baseline justify-between border-b border-foreground px-4 py-2.5 text-small">
            <span className="font-semibold">Rapport du jour</span>
            <span className="text-muted-foreground">exemple</span>
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
                    {row.reading} · <span className="text-foreground">{row.action}</span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3 border-t border-foreground px-4 py-2 font-mono text-micro text-muted-foreground">
            Froid <HeatScale className="flex-1" /> Chaud
          </div>
        </figure>
        <p className="mt-6 text-small text-muted-foreground">
          Par défaut, rien ne part à vos prospects sans votre accord.
        </p>
      </div>
    </aside>
  );
}
