const PAGES = [
  { n: 1, title: "Couverture", time: "0:14", width: 8 },
  { n: 2, title: "Contexte", time: "0:41", width: 20 },
  { n: 3, title: "Méthode", time: "1:12", width: 34 },
  { n: 4, title: "Tarifs", time: "3:38", width: 100, pricing: true },
  { n: 5, title: "Conditions", time: "0:22", width: 11 },
];

/** What the seller sees about one prospect, drawn in HTML. Decorative. */
export function HeroMockup() {
  return (
    <figure className="relative mx-auto w-full max-w-md lg:mx-0">
      <figcaption className="sr-only">
        Exemple : Marie Dupont lit le devis en ce moment, elle a passé 3 min 38 sur la page tarifs. Clozer la
        juge chaude et a préparé une relance à valider.
      </figcaption>

      <div aria-hidden className="pointer-events-none absolute -inset-10 -z-10 rounded-full bg-heat-hot/10 blur-3xl" />

      <div aria-hidden className="animate-rise rounded-2xl bg-sheet p-5 shadow-lg ring-1 ring-rule">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 font-semibold">
              Atelier Morel
              <span className="relative flex size-2">
                <span className="live-ping absolute inline-flex size-full rounded-full bg-heat-hot" />
                <span className="relative inline-flex size-2 rounded-full bg-heat-hot" />
              </span>
            </p>
            <p className="text-small text-ink-soft">Marie Dupont · en train de lire</p>
          </div>
          <div className="text-right">
            <p className="text-small font-medium text-heat-hot">Chaud</p>
            <p className="font-mono text-small text-ink-soft">86/100</p>
          </div>
        </div>

        <p className="mt-5 mb-3 text-micro font-medium tracking-wide text-ink-soft uppercase">
          Devis · Refonte du site · temps par page
        </p>
        <ul className="space-y-2.5">
          {PAGES.map((page, index) => (
            <li key={page.n} className="grid gap-1">
              <div className="flex items-baseline justify-between gap-3 text-small">
                <span className={page.pricing ? "font-medium" : "text-ink-soft"}>
                  <span className="font-mono text-ink-soft">{page.n}.</span> {page.title}
                </span>
                <span className="font-mono text-micro text-ink-soft">{page.time}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={`read-bar h-full rounded-full ${page.pricing ? "bg-heat-warm" : "bg-ink/70"}`}
                  style={{ width: `${page.width}%`, animationDelay: `${0.3 + index * 0.1}s` }}
                />
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex items-start gap-2 rounded-lg bg-muted px-3 py-2.5 text-small">
          <SparkIcon />
          <span>
            <span className="font-medium">Négocie, dynamique en hausse.</span>{" "}
            <span className="text-ink-soft">Le prix coince : proposez un échéancier.</span>
          </span>
        </div>
      </div>

      <div
        aria-hidden
        className="animate-rise relative mt-3 ml-6 rounded-2xl bg-sheet p-4 shadow-md ring-1 ring-rule [animation-delay:250ms] sm:-mr-8 sm:ml-14"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-small font-semibold">Relance prête</p>
          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-micro font-medium text-brand">À valider</span>
        </div>
        <p className="mt-2 text-small leading-relaxed text-ink-soft">
          « Bonjour Marie, pour faciliter la décision, je peux vous proposer un paiement en trois fois. Un
          créneau jeudi pour en parler ? »
        </p>
        <div className="mt-3 flex gap-2">
          <span className="rounded-lg bg-ink px-3 py-1.5 text-micro font-medium text-sheet">Valider l&apos;envoi</span>
          <span className="rounded-lg px-3 py-1.5 text-micro font-medium text-ink-soft ring-1 ring-rule">
            Modifier
          </span>
        </div>
      </div>
    </figure>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 16 16" className="mt-0.5 size-3.5 shrink-0 text-brand" fill="currentColor" aria-hidden>
      <path d="M8 1.5l1.3 3.6 3.7 1.4-3.7 1.4L8 11.5 6.7 7.9 3 6.5l3.7-1.4L8 1.5zM12.5 10l.6 1.6 1.6.6-1.6.6-.6 1.7-.6-1.7-1.6-.6 1.6-.6.6-1.6z" />
    </svg>
  );
}
