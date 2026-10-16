import { Icon } from "@/components/icons";
import { APP_URL, CONTACT_EMAIL } from "@/components/links";
import { SignupForm } from "@/components/signup-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { HeatScale, ThermalPlate } from "@/components/thermal-plate";
import { ThermalReading } from "@/components/thermal-reading";

const STEPS = [
  {
    title: "Déposez votre document",
    body: "Un PDF, une page web (Notion, Loom, Figma…) ou un pitch vidéo de trois minutes. Clozer reconnaît s'il s'agit d'un devis, d'une facture, d'une présentation ou d'un CV, et lit chaque page en conséquence : sur un CV, « Tarifs » devient votre taux journalier.",
    measure: "10 types reconnus",
  },
  {
    title: "Envoyez le lien",
    body: "Copiez-le dans votre email, sur WhatsApp ou LinkedIn, ou laissez l'extension Gmail et Outlook remplacer la pièce jointe pour vous. Un lien par destinataire : vous savez qui lit, et qui ne fait rien.",
    measure: "1 lien = 1 lecteur",
  },
  {
    title: "Laissez Clozer relancer",
    body: "Il voit qui lit quoi, écrit la relance et propose le jour et l'heure d'envoi. Vous validez d'un clic.",
    measure: "Relance validée par vous",
  },
];

const SEND_WAYS = [
  {
    name: "Le lien",
    status: "Disponible",
    available: true,
    body: "Déposez le document : le lien est prêt dans la seconde. Collez-le où vous écrivez déjà à vos clients, email, WhatsApp, LinkedIn, SMS. Votre client l'ouvre dans son navigateur, sur ordinateur comme sur téléphone, sans rien installer.",
  },
  {
    name: "Depuis Gmail ou Outlook",
    status: "Bientôt",
    available: false,
    body: "Joignez votre PDF comme d'habitude. Au moment d'envoyer, l'extension le remplace par un lien Clozer, et vous prévient en haut de votre boîte quand il est lu. L'extension Chrome (Gmail et Outlook dans le navigateur) est en cours de validation par Google ; le complément pour Outlook installé suit.",
  },
];

// Example follow-up, labelled as such.
const FOLLOWUP_STEPS = [
  { label: "Ce qui a été lu", value: "Tarifs relus 3 fois, Planning survolé" },
  { label: "Ce qui coince", value: "Le prix, d'après le temps passé sur l'échéancier" },
  { label: "Envoi proposé", value: "Jeudi 22 oct., 10:30, heure du prospect" },
];

const READINGS = [
  {
    title: "Page par page",
    body: "Pages lues, temps passé sur chacune, retours sur les tarifs, nombre de lecteurs. Pour une vidéo, les passages regardés et où le prospect a décroché. Vous voyez si le document circule en interne.",
  },
  {
    title: "En direct",
    body: "Une notification dans Chrome, ou en haut de Gmail et Outlook, quand un prospect lit. Une alerte part s'il revient après un long silence ou s'il lit à plusieurs.",
  },
  {
    title: "Une température qui s'explique",
    body: "Froid, tiède, chaud : un score sur 100 dont chaque point a une raison lisible. Pas de boîte noire.",
  },
  {
    title: "Une lecture de chaque deal",
    body: "Où en est le prospect, ce qui coince, quoi faire et quand. Chaque affirmation renvoie à un fait mesuré, sinon elle est écartée.",
  },
  {
    title: "Le prospect répond dans le document",
    body: "Valider la proposition, demander un ajustement, prendre rendez-vous dans votre agenda, poser une question à l'assistant ou laisser un vocal sur une page. Tout remonte en tête de votre tableau de bord.",
  },
];

// Example score breakdown, labelled as such.
const SCORE_REASONS = [
  { points: "+34", label: "Tarifs lus 3 min 38" },
  { points: "+22", label: "Revenu 3 fois depuis hier" },
  { points: "+18", label: "Transmis à un 2e lecteur" },
  { points: "+12", label: "Méthode lue en entier" },
];

const GUARANTEES = [
  "Le prospect est informé, sur la page, de ce que l'expéditeur voit.",
  "Une relance ne laisse jamais deviner que vous suivez la lecture.",
  "Trois relances par mois et par contact au maximum, jamais juste après une lecture.",
  "Lien de désinscription dans chaque relance, adresses IP jamais stockées en clair.",
];

const SEGMENTS = [
  {
    name: "Solo",
    who: "Indépendants, artisans, consultants, agences de quelques personnes.",
    body: "Devis, factures, présentations : un lien par client, les relances écrites pour vous. Connexion avec Google ou votre email, premier lien en quelques minutes.",
    offer: "Gratuit pendant la bêta",
    action: { label: "Créer mon compte", href: APP_URL },
  },
  {
    name: "Équipe",
    who: "Commerciaux de PME avec un manager.",
    body: "Invitez l'équipe : chacun suit ses deals, le manager voit l'ensemble dans la vue Équipe. Alertes par email, Slack, Chrome ou Outlook.",
    offer: "Gratuit pendant la bêta",
    action: { label: "Créer l'espace d'équipe", href: APP_URL },
  },
  {
    name: "Entreprise",
    who: "Grandes équipes commerciales.",
    body: "Déploiement à plusieurs équipes, besoins de sécurité ou d'intégration : on regarde votre cas ensemble avant de vous ouvrir l'accès.",
    offer: "Sur échange",
    action: { label: "Nous écrire", href: `mailto:${CONTACT_EMAIL}?subject=Clozer%20pour%20notre%20%C3%A9quipe` },
  },
];

const BETA_INCLUDES = [
  "PDF, pages web et pitchs vidéo",
  "Extension Gmail et Outlook dès sa sortie",
  "Suivi page par page, alertes en direct",
  "Lecture des deals, relances préparées",
  "Rendez-vous, assistant et vocaux du prospect",
];

const FAQ = [
  {
    q: "Le prospect sait-il que sa lecture est suivie ?",
    a: "Oui. Une mention claire figure sur la page du document, avec un lien vers notre politique de confidentialité. Les relances, elles, restent naturelles : elles ne citent jamais une page ni un temps de lecture.",
  },
  {
    q: "Les relances partent-elles toutes seules ?",
    a: "Par défaut, Clozer écrit la relance et propose le jour et l'heure d'envoi ; vous la relisez et la validez d'un clic. Vous pouvez ensuite le laisser envoyer seul les messages simples quand il est sûr de lui. Les cas délicats (une objection, une question du prospect) vous attendent toujours.",
  },
  {
    q: "Quels documents puis-je envoyer ?",
    a: "Tout ce que vous envoyez à un client ou un prospect. Un PDF, quel qu'il soit : devis, facture, proposition, présentation, document technique, contrat, CV, plaquette, étude de cas. Clozer reconnaît le type et vous montre la lecture page par page. Une page web (Notion, Loom, Figma, Google Slides, Webflow…) : l'ouverture et le temps passé, et une vue lecture si le site refuse de s'afficher dans Clozer. Un pitch vidéo enregistré dans Clozer, jusqu'à trois minutes : vous savez jusqu'où il a été regardé.",
  },
  {
    q: "Mes propres ouvertures faussent-elles les chiffres ?",
    a: "Non. Quand vous ouvrez vos liens en étant connecté à Clozer, la lecture est ignorée. Les robots sont écartés aussi.",
  },
  {
    q: "Faut-il installer quelque chose ?",
    a: "Non. Vous vous connectez avec Google ou votre email, sans mot de passe, vous copiez le lien et votre client le lit dans son navigateur, sur ordinateur comme sur téléphone. L'extension pour Gmail et Outlook est un raccourci en plus, pas une obligation.",
  },
  {
    q: "Quand l'extension Gmail et Outlook sera-t-elle disponible ?",
    a: "L'extension Chrome, qui marche dans Gmail et dans Outlook ouvert dans le navigateur, est en cours de validation par Google. Le complément pour Outlook installé sur Windows et Mac suit. Créez votre compte dès maintenant : vous serez prévenu à sa sortie, et vos liens existants continueront de fonctionner.",
  },
  {
    q: "Le prospect peut-il me répondre ?",
    a: "Oui, sans quitter le document. Il peut valider la proposition ou demander un ajustement, prendre rendez-vous dans votre agenda (Calendly, Cal.com…), poser ses questions à l'assistant qui répond à partir de votre offre quand vous n'êtes pas là, ou laisser un vocal sur une page. Vous recevez tout, avec la transcription.",
  },
];

const WRAP = "mx-auto w-full max-w-[90rem] px-5 sm:px-8";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col overflow-x-clip">
      <SiteHeader />

      <main className="flex-1">
        {/* Report header: the promise, and the signup in the "Client" field. */}
        <section>
          <p className={`${WRAP} flex flex-wrap gap-x-6 gap-y-1 border-b border-rule py-3 font-mono text-micro text-ink-soft`}>
            <span>Rapport de lecture n° 0412</span>
            <span>Atelier Morel</span>
            <span className="font-sans font-medium text-ink">Exemple de démonstration</span>
          </p>
          <div className={`${WRAP} grid gap-10 pt-10 pb-12 md:pt-14 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-end lg:gap-16`}>
            <div>
              <h1 className="condensed max-w-[12ch] text-display font-extrabold">
                Voyez où votre document{" "}
                <span className="relative inline-block">
                  chauffe.
                  <HeatScale orientation="horizontal" className="absolute inset-x-0 -bottom-2 sm:-bottom-3" />
                </span>
              </h1>
              <p className="mt-10 max-w-[54ch] text-lead text-ink-soft">
                Devis, facture, présentation, doc technique, contrat : envoyez un lien à la place de la pièce jointe.
                Clozer mesure la lecture page par page, vous dit qui relancer, écrit la relance et propose l&apos;heure
                d&apos;envoi.
              </p>
            </div>
            <div>
              <SignupForm id="email-hero" />
              <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-small text-ink-soft">
                <span>Gratuit pendant la bêta</span>
                <span>Sans carte bancaire</span>
              </p>
            </div>
          </div>

          <ThermalReading />

          <div className="border-b border-ink">
          <dl className={`${WRAP} grid grid-cols-2 text-small md:grid-cols-4`}>
            <Readout label="Prospect">Marie Dupont · Atelier Morel</Readout>
            <Readout label="Température">
              <span className="inline-flex items-center gap-2">
                <span className="size-2.5 bg-iron-2" aria-hidden />
                Chaud · <span className="font-mono">86/100</span>
              </span>
            </Readout>
            <Readout label="Activité">Revenu 3 fois depuis hier</Readout>
            <Readout label="À faire">
              <span className="hatch inline-flex px-2 py-0.5 text-ink-soft">
                <span className="bg-paper px-1 text-ink">Relance prévue hier</span>
              </span>
            </Readout>
          </dl>
          </div>
        </section>

        {/* The problem, shown: an attachment measures nothing. */}
        <section className="border-b border-ink">
          <div className={`${WRAP} grid gap-12 py-20 md:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20`}>
            <div>
              <h2 className="condensed text-title font-bold">Après l&apos;envoi, le silence.</h2>
              <p className="mt-6 max-w-[56ch] text-lead text-ink-soft">
                Le document est parti. A-t-il été ouvert ? Lu jusqu&apos;aux tarifs ? Transmis au décideur ? Vous relancez
                à l&apos;aveugle : trop tôt, vous agacez ; trop tard, le prospect a signé ailleurs.
              </p>
              <p className="mt-4 max-w-[56ch] text-lead">
                Clozer remplace la pièce jointe par un lien, et le doute par ce qui s&apos;est vraiment passé.
              </p>
            </div>
            <div className="grid gap-8 self-center">
              <Comparison label="Pièce jointe PDF" verdict="Aucune mesure">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="aspect-[3/4] border border-rule bg-sheet" />
                ))}
              </Comparison>
              <Comparison label="Lien Clozer" verdict="Tarifs lus 3 min 38">
                {[0.3, 0.5, 0.68, 1, 0.38, 0].map((heat, i) => (
                  <ThermalPlate key={i} heat={heat} seed={i} className="aspect-[3/4]" />
                ))}
              </Comparison>
            </div>
          </div>
        </section>

        {/* Two ways to send: the link today, the mailbox extension soon. */}
        <section id="envoi" className="scroll-mt-14 border-b border-ink bg-sheet">
          <div className={`${WRAP} py-20 md:py-28`}>
            <h2 className="condensed max-w-[20ch] text-title font-bold">Deux façons d&apos;envoyer. Aucune à apprendre.</h2>
            <div className="mt-14 grid border-t border-ink md:grid-cols-2">
              {SEND_WAYS.map((way) => (
                <article
                  key={way.name}
                  className="border-b border-rule py-8 md:border-b-0 md:px-8 md:first:border-r md:first:pl-0 md:last:pr-0"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="condensed text-[2rem] leading-none font-extrabold tracking-[-0.03em]">{way.name}</h3>
                    <span
                      className={`px-2 py-0.5 text-small font-semibold ${way.available ? "bg-ink text-sheet" : "border border-ink"}`}
                    >
                      {way.status}
                    </span>
                  </div>
                  <p className="mt-4 max-w-[58ch] text-body text-ink-soft">{way.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works: the protocol, three rows. */}
        <section id="comment" className="scroll-mt-14 border-b border-ink">
          <div className={`${WRAP} py-20 md:py-28`}>
            <h2 className="condensed max-w-[18ch] text-title font-bold">Trois gestes, une fois par document.</h2>
            <ol className="mt-14 border-t border-ink">
              {STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="grid gap-3 border-b border-rule py-8 md:grid-cols-[4rem_minmax(0,5fr)_minmax(0,6fr)_minmax(0,3fr)] md:gap-8"
                >
                  <span className="font-mono text-small text-ink-soft">{index + 1}/3</span>
                  <h3 className="condensed text-[1.75rem] leading-tight font-bold tracking-[-0.02em]">{step.title}</h3>
                  <p className="max-w-[60ch] text-body text-ink-soft">{step.body}</p>
                  <p className="text-small font-medium md:text-right">{step.measure}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Follow-ups: written, timed and guarded by Clozer, approved by the seller. */}
        <section id="relances" className="scroll-mt-14 border-b border-ink">
          <div className={`${WRAP} grid gap-14 py-20 md:py-28 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] lg:gap-20`}>
            <div>
              <h2 className="condensed max-w-[16ch] text-title font-bold">Les relances s&apos;écrivent et se programment seules.</h2>
              <p className="mt-6 max-w-[54ch] text-lead text-ink-soft">
                Clozer part de ce que votre client a vraiment lu et de votre offre. Il écrit une relance qui répond à
                ce qui coince, et choisit le moment : un jour ouvré, en heures de bureau, dans le fuseau de votre
                client.
              </p>
              <p className="mt-4 max-w-[54ch] text-lead">
                Vous validez d&apos;un clic, ou vous laissez partir seules les relances simples. Les cas délicats
                vous attendent toujours.
              </p>
            </div>
            <figure className="border border-ink bg-sheet lg:self-start">
              <figcaption className="sr-only">
                Exemple de relance préparée par Clozer, avec l&apos;envoi proposé jeudi à 10 h 30, heure du prospect.
              </figcaption>
              <div aria-hidden>
                <p className="flex items-baseline justify-between gap-4 border-b border-ink px-5 py-3 text-small">
                  <span className="font-semibold">Relance préparée · Marie Dupont</span>
                  <span className="text-ink-soft">à valider</span>
                </p>
                <dl className="divide-y divide-rule border-b border-ink px-5">
                  {FOLLOWUP_STEPS.map((step) => (
                    <div key={step.label} className="grid gap-1 py-3 text-small sm:grid-cols-[9rem_minmax(0,1fr)]">
                      <dt className="text-ink-soft">{step.label}</dt>
                      <dd className="font-medium">{step.value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="px-5 py-4 text-body">
                  « Bonjour Marie, pour faciliter la décision, je peux vous proposer un paiement en trois fois. Un
                  créneau jeudi pour en parler ? »
                </p>
                <div className="flex gap-2 px-5 pb-5 text-small font-semibold">
                  <span className="bg-ink px-3 py-2 text-sheet">Valider l&apos;envoi</span>
                  <span className="border border-ink px-3 py-2">Modifier</span>
                </div>
              </div>
              <p className="border-t border-rule px-5 py-2 text-micro text-ink-soft">Exemple de démonstration</p>
            </figure>
          </div>
        </section>

        {/* What you see: one prospect sheet as the specimen, the readings beside it. */}
        <section id="releves" className="scroll-mt-14 border-b border-ink bg-sheet">
          <div className={`${WRAP} grid gap-14 py-20 md:py-28 lg:grid-cols-[minmax(0,6fr)_minmax(0,7fr)] lg:gap-20`}>
            <div className="lg:sticky lg:top-24 lg:self-start">
              <h2 className="condensed max-w-[16ch] text-title font-bold">Une fiche par prospect, chaque matin.</h2>
              <ProspectSheet />
            </div>
            <ul className="border-t border-ink lg:mt-2">
              {READINGS.map((item) => (
                <li key={item.title} className="border-b border-rule py-7">
                  <h3 className="text-[1.25rem] leading-snug font-semibold tracking-[-0.01em]">{item.title}</h3>
                  <p className="mt-2 max-w-[62ch] text-body text-ink-soft">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Respect: the one dark band. */}
        <section className="bg-ink text-sheet">
          <div className={`${WRAP} grid gap-12 py-20 md:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20`}>
            <div>
              <h2 className="condensed text-title font-bold">Suivre sans fliquer.</h2>
              <p className="mt-6 max-w-[48ch] text-lead text-sheet/75">
                Vos prospects sont vos futurs clients. La chaleur se mesure sur les pages, jamais sur les personnes,
                et votre relance reste celle d&apos;un commercial attentif.
              </p>
            </div>
            <ul className="border-t border-sheet/30 self-center">
              {GUARANTEES.map((item) => (
                <li key={item} className="flex gap-4 border-b border-sheet/20 py-5 text-lead">
                  <Icon name="check" className="mt-1 size-5 shrink-0 text-sheet/60" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Segments: no prices exist yet, so none are shown. */}
        <section id="pour-qui" className="scroll-mt-14 border-b border-ink">
          <div className={`${WRAP} py-20 md:py-28`}>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <h2 className="condensed max-w-[16ch] text-title font-bold">Un seul outil, de l&apos;artisan à l&apos;équipe.</h2>
              <p className="max-w-[40ch] text-body text-ink-soft">
                Clozer est en bêta : tout est ouvert, sans carte bancaire. Si une offre payante arrive, vous serez
                prévenu avant.
              </p>
            </div>
            <div className="mt-14 grid border-t border-ink md:grid-cols-3">
              {SEGMENTS.map((segment) => (
                <article
                  key={segment.name}
                  className="flex flex-col border-b border-rule py-8 md:border-r md:border-b-0 md:px-8 md:first:pl-0 md:last:border-r-0 md:last:pr-0"
                >
                  <h3 className="condensed text-[2.5rem] leading-none font-extrabold tracking-[-0.03em]">{segment.name}</h3>
                  <p className="mt-4 font-medium">{segment.who}</p>
                  <p className="mt-2 flex-1 text-body text-ink-soft">{segment.body}</p>
                  <p className="mt-8 text-small font-semibold">{segment.offer}</p>
                  <a
                    href={segment.action.href}
                    className="group mt-3 flex h-12 items-center justify-between border border-ink px-4 font-semibold transition-colors hover:bg-ink hover:text-sheet"
                  >
                    {segment.action.label}
                    <Icon name="arrow" className="size-5 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-1" />
                  </a>
                </article>
              ))}
            </div>
            <p className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-small text-ink-soft">
              <span className="font-medium text-ink">Inclus pendant la bêta :</span>
              {BETA_INCLUDES.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-14 border-b border-ink">
          <div className={`${WRAP} grid gap-12 py-20 md:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20`}>
            <div>
              <h2 className="condensed text-title font-bold">Ce qu&apos;on nous demande.</h2>
              <p className="mt-6 text-lead text-ink-soft">
                Une autre question ?{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-ink underline underline-offset-4">
                  Écrivez-nous
                </a>
                .
              </p>
            </div>
            <div className="border-t border-ink">
              {FAQ.map((item) => (
                <details key={item.q} className="group border-b border-rule">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[1.125rem] font-semibold [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <Icon
                      name="plus"
                      className="size-5 shrink-0 transition-transform duration-300 ease-[var(--ease-out-expo)] group-open:rotate-45"
                    />
                  </summary>
                  <p className="max-w-[62ch] pb-6 text-body text-ink-soft">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Close: the same field, once more. */}
        <section>
          <div className={`${WRAP} grid gap-10 py-20 md:py-28 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-end lg:gap-16`}>
            <h2 className="condensed max-w-[14ch] text-display font-extrabold">Votre prochain document part avec un lien suivi.</h2>
            <SignupForm id="email-final" />
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function Readout({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-rule py-3 odd:pr-4 even:pl-4 max-md:nth-[-n+2]:border-b max-md:odd:border-r md:border-r md:px-4 md:first:pl-0 md:last:border-r-0">
      <dt className="font-mono text-micro text-ink-soft">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

function Comparison({ label, verdict, children }: { label: string; verdict: string; children: React.ReactNode }) {
  return (
    <figure>
      <figcaption className="mb-3 flex items-baseline justify-between gap-4 border-b border-ink pb-2 text-small">
        <span className="font-semibold">{label}</span>
        <span className="text-ink-soft">{verdict}</span>
      </figcaption>
      <div className="grid grid-cols-6 gap-2">{children}</div>
    </figure>
  );
}

function ProspectSheet() {
  return (
    <figure className="mt-10 border border-ink bg-paper">
      <figcaption className="sr-only">
        Exemple de fiche prospect : Marie Dupont, chaude, 86 sur 100, avec le détail du score.
      </figcaption>
      <div aria-hidden>
        <div className="flex items-start justify-between gap-4 border-b border-ink p-5">
          <div>
            <p className="text-lead font-semibold">Marie Dupont</p>
            <p className="text-small text-ink-soft">Atelier Morel · proposition « Refonte du site »</p>
          </div>
          <div className="text-right">
            <p className="condensed text-[2.75rem] leading-none font-extrabold">86</p>
            <p className="font-mono text-micro text-ink-soft">/100 · chaud</p>
          </div>
        </div>
        <div className="grid grid-cols-6 gap-1 border-b border-ink p-5">
          {[0.3, 0.5, 0.68, 1, 0.38, 0].map((heat, i) => (
            <ThermalPlate key={i} heat={heat} seed={i} className="aspect-[3/4]" />
          ))}
        </div>
        <ul className="divide-y divide-rule px-5">
          {SCORE_REASONS.map((reason) => (
            <li key={reason.label} className="flex items-baseline gap-4 py-2.5 text-small">
              <span className="w-8 font-mono">{reason.points}</span>
              {reason.label}
            </li>
          ))}
        </ul>
      </div>
      <p className="border-t border-rule px-5 py-2 text-micro text-ink-soft">Exemple de démonstration</p>
    </figure>
  );
}
