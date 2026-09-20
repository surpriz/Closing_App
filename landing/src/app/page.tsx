const APP_URL = "https://app.clozer.club/login";

const pages = [
  { number: 1, title: "Couverture", time: "0:14", width: 7 },
  { number: 2, title: "Contexte", time: "0:41", width: 19 },
  { number: 3, title: "Méthode", time: "1:12", width: 33 },
  { number: 4, title: "Tarifs", time: "3:38", width: 100, marked: true },
  { number: 5, title: "Conditions", time: "0:22", width: 10 },
];

const steps = [
  {
    title: "Déposez le devis",
    body: "Un PDF, et c'est tout. Le prospect le lit dans son navigateur, il n'a rien à télécharger.",
  },
  {
    title: "Un lien par personne",
    body: "Chaque prospect reçoit son propre lien. Vous savez qui a ouvert, et qui fait semblant.",
  },
  {
    title: "La relance arrive quand il faut",
    body: "Retour sur la page tarifs, dossier qui refroidit : Clozer écrit le message et l'envoie au bon moment.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6">
      <header className="flex items-center justify-between border-b border-rule py-6">
        <span className="font-display text-lg font-semibold tracking-tight">
          Clozer
        </span>
        <a
          href={APP_URL}
          className="font-display text-sm font-medium text-ink-soft transition-colors hover:text-ink"
        >
          Se connecter
        </a>
      </header>

      <main>
        <section className="grid items-start gap-14 py-16 md:grid-cols-[1fr_minmax(0,22rem)] md:gap-12 md:py-24">
          <div className="max-w-[34rem]">
            <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-5xl">
              Vous saurez qui a lu votre devis, et jusqu&apos;où.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-ink-soft">
              Vous envoyez une proposition, puis plus rien. Clozer transforme ce
              PDF en lien suivi : vous voyez les pages lues, le temps passé, les
              allers-retours sur les tarifs. Et la relance part pendant que le
              sujet est encore chaud.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-6">
              <a
                href={APP_URL}
                className="font-display inline-flex items-center rounded-sm bg-ink px-6 py-3 text-sm font-medium text-sheet transition-colors hover:bg-ink-soft"
              >
                Créer mon premier lien
              </a>
              <a
                href="#comment"
                className="font-display text-sm font-medium underline decoration-rule decoration-2 underline-offset-[6px] transition-colors hover:decoration-ink"
              >
                Comment ça marche
              </a>
            </div>
          </div>

          <figure className="border border-rule bg-sheet p-6">
            <figcaption className="flex items-baseline justify-between gap-4 border-b border-rule pb-4">
              <span className="font-display text-sm font-semibold">
                Marie Dupont
              </span>
              <span className="text-sm text-ink-soft">il y a 12 min</span>
            </figcaption>
            <p className="pt-4 text-sm text-ink-soft">
              Devis — Refonte du site, 5 pages
            </p>

            <ul className="mt-5 space-y-3">
              {pages.map((page, index) => (
                <li key={page.number} className="grid gap-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span>
                      <span className="text-ink-soft tabular-nums">
                        {page.number}.
                      </span>{" "}
                      <span className={page.marked ? "bg-mark px-1" : undefined}>
                        {page.title}
                      </span>
                    </span>
                    <span className="font-display text-xs text-ink-soft tabular-nums">
                      {page.time}
                    </span>
                  </div>
                  <div className="h-1.5 bg-paper">
                    <div
                      className={`read-bar h-full ${page.marked ? "bg-mark" : "bg-ink"}`}
                      style={{
                        width: `${page.width}%`,
                        animationDelay: `${0.15 + index * 0.12}s`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-6 flex items-start gap-2 border-t border-rule pt-4 text-sm text-ink-soft">
              <span
                aria-hidden="true"
                className="mt-[0.45rem] size-2 shrink-0 rounded-full bg-seal"
              />
              <span>
                Relance prête. Départ demain, 9 h 12.
              </span>
            </p>
          </figure>
        </section>

        <section
          id="comment"
          className="scroll-mt-8 border-t border-rule py-16 md:py-20"
        >
          <h2 className="font-display text-sm font-semibold tracking-tight">
            Trois étapes, une par devis
          </h2>
          <ol className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
            {steps.map((step, index) => (
              <li key={step.title} className="border-t-2 border-ink pt-5">
                <span className="font-display text-xs text-ink-soft tabular-nums">
                  Étape {index + 1}
                </span>
                <h3 className="font-display mt-2 text-xl font-semibold tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-3 leading-relaxed text-ink-soft">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-rule py-16 md:py-20">
          <p className="max-w-[28rem] font-display text-2xl font-semibold leading-tight tracking-tight text-balance sm:text-3xl">
            Votre prochain devis peut partir avec un lien suivi.
          </p>
          <a
            href={APP_URL}
            className="font-display mt-8 inline-flex items-center rounded-sm bg-ink px-6 py-3 text-sm font-medium text-sheet transition-colors hover:bg-ink-soft"
          >
            Ouvrir Clozer
          </a>
        </section>
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-rule py-8 text-sm text-ink-soft">
        <span>Clozer</span>
        <a
          href="mailto:contact@clozer.club"
          className="transition-colors hover:text-ink"
        >
          contact@clozer.club
        </a>
      </footer>
    </div>
  );
}
