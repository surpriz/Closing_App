import { PrimaryCta } from "@/components/cta";
import { HeroMockup } from "@/components/hero-mockup";
import { Icon, type IconName } from "@/components/icons";
import { CONTACT_EMAIL } from "@/components/links";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

const STEPS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "upload",
    title: "Ajoutez votre proposition",
    body: "Un devis ou une présentation en PDF, ou un lien Notion, Loom, Figma. Rien à installer, ni pour vous ni pour le prospect.",
  },
  {
    icon: "link",
    title: "Un lien par prospect",
    body: "Collez-le dans votre email à la place de la pièce jointe. Chaque personne a le sien : vous savez qui lit, et qui ne lit pas.",
  },
  {
    icon: "send",
    title: "Relancez au bon moment",
    body: "Clozer suit la lecture, vous dit qui relancer aujourd'hui et prépare le message. Vous le relisez, il part.",
  },
];

const FEATURES: { icon: IconName; title: string; body: string; wide?: boolean }[] = [
  {
    icon: "eye",
    title: "Page par page",
    body: "Pages lues, temps passé sur chacune, retours sur les tarifs, nombre de lecteurs. Vous voyez si le devis circule en interne.",
    wide: true,
  },
  {
    icon: "radio",
    title: "En direct",
    body: "Un bandeau s'allume quand un prospect lit. Une alerte part s'il revient après un long silence ou s'il lit à plusieurs.",
  },
  {
    icon: "gauge",
    title: "Une température qui s'explique",
    body: "Froid, tiède, chaud : un score sur 100 dont chaque point a une raison lisible. Pas de boîte noire.",
  },
  {
    icon: "sparkles",
    title: "Une lecture de chaque deal",
    body: "Où en est le prospect, ce qui coince, quoi faire et quand. Chaque affirmation renvoie à un fait mesuré, sinon elle est écartée.",
    wide: true,
  },
  {
    icon: "pen",
    title: "Des relances prêtes",
    body: "Écrites à partir de votre offre et de ce qui a été lu, envoyées aux heures de bureau du prospect. Par défaut, vous validez chacune.",
  },
  {
    icon: "message",
    title: "Le prospect répond dans le document",
    body: "Deux boutons sous la proposition : la valider, ou demander un ajustement. Sa réponse remonte en tête de votre tableau de bord.",
    wide: true,
  },
];

const GUARANTEES = [
  "Le prospect est informé, sur la page, de ce que l'expéditeur voit.",
  "Une relance ne laisse jamais deviner que vous suivez la lecture.",
  "Trois relances par mois et par contact au maximum, jamais juste après une lecture.",
  "Lien de désinscription dans chaque relance, adresses IP jamais stockées en clair.",
];

const BETA_INCLUDES = [
  "Documents et liens prospects",
  "Suivi page par page et alertes en direct",
  "Lecture des deals et relances préparées",
  "Alertes par email ou Slack",
];

const FAQ = [
  {
    q: "Le prospect sait-il que sa lecture est suivie ?",
    a: "Oui. Une mention claire figure sur la page du document, avec un lien vers notre politique de confidentialité. Les relances, elles, restent naturelles : elles ne citent jamais une page ni un temps de lecture.",
  },
  {
    q: "Les relances partent-elles toutes seules ?",
    a: "Pas par défaut. Clozer prépare la relance, vous la relisez et la validez. Vous pouvez ensuite le laisser envoyer seul les messages simples quand il est sûr de lui ; les cas délicats vous attendent toujours.",
  },
  {
    q: "Quels documents puis-je envoyer ?",
    a: "Des PDF (devis, propositions, présentations) et des pages web : Notion, Loom, Figma, Google Slides, Webflow… Pour un PDF, vous voyez la lecture page par page ; pour une page web, l'ouverture et le temps passé.",
  },
  {
    q: "Mes propres ouvertures faussent-elles les chiffres ?",
    a: "Non. Quand vous ouvrez vos liens en étant connecté à Clozer, la lecture est ignorée. Les robots sont écartés aussi.",
  },
  {
    q: "Faut-il installer quelque chose ?",
    a: "Rien. Vous vous connectez avec votre email, sans mot de passe, et le prospect lit dans son navigateur, sur ordinateur comme sur téléphone.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-col overflow-x-clip">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-16 px-5 pt-14 pb-20 sm:px-6 md:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-12 lg:pb-28">
          <div className="animate-rise max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-sheet px-3 py-1 text-small font-medium shadow-xs ring-1 ring-rule">
              <span className="size-1.5 rounded-full bg-success" aria-hidden />
              Gratuit pendant la bêta
            </p>
            <h1 className="mt-6 text-[2.5rem] leading-[1.06] font-medium tracking-[-0.035em] [font-stretch:88%] sm:text-display">
              Sachez qui lit votre devis. <span className="text-ink-soft">Relancez au bon moment.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-soft">
              Envoyez votre proposition en lien suivi. Clozer vous montre les pages lues, le temps passé, les
              retours sur les tarifs, puis vous dit qui relancer aujourd&apos;hui et prépare le message.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
              <PrimaryCta>Créer mon premier lien</PrimaryCta>
              <a
                href="#comment"
                className="text-sm font-medium text-ink-soft underline decoration-rule decoration-2 underline-offset-[6px] transition-colors hover:text-ink hover:decoration-ink"
              >
                Voir comment ça marche
              </a>
            </div>
            <p className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-small text-ink-soft">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="check" className="size-3.5 text-success" /> Sans carte bancaire
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="check" className="size-3.5 text-success" /> Rien à installer
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="check" className="size-3.5 text-success" /> Connexion par email
              </span>
            </p>
          </div>
          <HeroMockup />
        </section>

        {/* Problem */}
        <section className="border-y border-rule bg-sheet">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-5 py-16 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:py-20">
            <h2 className="text-title font-medium [font-stretch:92%]">Après l&apos;envoi, le silence.</h2>
            <div className="space-y-4 text-lg leading-relaxed text-ink-soft">
              <p>
                Le devis est parti. A-t-il été ouvert ? Lu jusqu&apos;aux tarifs ? Transmis au décideur ? Vous
                relancez à l&apos;aveugle : trop tôt, vous agacez ; trop tard, le prospect a signé ailleurs.
              </p>
              <p className="text-ink">
                Clozer remplace la pièce jointe par un lien, et le doute par ce qui s&apos;est vraiment passé.
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="comment" className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-20 sm:px-6 md:py-28">
          <SectionHeading kicker="Comment ça marche" title="Trois étapes, une seule fois par proposition." />
          <ol className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="rounded-2xl bg-sheet p-6 shadow-xs ring-1 ring-rule">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-muted ring-1 ring-rule">
                    <Icon name={step.icon} className="size-[1.125rem]" />
                  </span>
                  <span className="font-mono text-small text-ink-soft">0{index + 1}</span>
                </div>
                <h3 className="mt-6 text-lg font-semibold tracking-[-0.01em]">{step.title}</h3>
                <p className="mt-2 text-body text-ink-soft">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Features */}
        <section id="fonctionnalites" className="scroll-mt-20 border-t border-rule bg-muted/50">
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-6 md:py-28">
            <SectionHeading
              kicker="Fonctionnalités"
              title="Tout ce qu'il faut pour savoir quand relancer, et quoi dire."
            />
            <ul className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
              {FEATURES.map((feature) => (
                <li
                  key={feature.title}
                  className={`rounded-2xl bg-sheet p-6 shadow-xs ring-1 ring-rule transition-shadow duration-200 hover:shadow-md ${feature.wide ? "md:col-span-2" : ""}`}
                >
                  <span className="flex size-9 items-center justify-center rounded-lg bg-ink text-sheet">
                    <Icon name={feature.icon} className="size-4" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold tracking-[-0.01em]">{feature.title}</h3>
                  <p className="mt-2 max-w-xl text-body text-ink-soft">{feature.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Respect */}
        <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-6 md:py-28">
          <div className="grid grid-cols-1 gap-12 rounded-3xl bg-ink p-8 text-sheet sm:p-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div>
              <span className="flex size-10 items-center justify-center rounded-xl bg-sheet/10">
                <Icon name="shield" className="size-5" />
              </span>
              <h2 className="mt-6 text-title font-medium [font-stretch:92%]">Suivre sans fliquer.</h2>
              <p className="mt-4 text-lg leading-relaxed text-sheet/70">
                Vos prospects sont vos futurs clients. Clozer est conçu pour les respecter, et pour que votre
                relance reste celle d&apos;un commercial attentif.
              </p>
            </div>
            <ul className="space-y-4 self-center">
              {GUARANTEES.map((item) => (
                <li key={item} className="flex gap-3 text-body">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success">
                    <Icon name="check" className="size-3 text-sheet" />
                  </span>
                  <span className="text-sheet/90">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Pricing */}
        <section id="tarif" className="scroll-mt-20 border-t border-rule">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-5 py-20 sm:px-6 md:grid-cols-2 md:py-28">
            <SectionHeading
              kicker="Tarif"
              title="Gratuit pendant la bêta."
              body="Clozer est en bêta. Toutes les fonctionnalités sont ouvertes, sans carte bancaire. Si une offre payante arrive, vous serez prévenu avant."
            />
            <div className="rounded-2xl bg-sheet p-8 shadow-md ring-1 ring-rule">
              <p className="flex items-baseline gap-2">
                <span className="text-5xl font-medium tracking-[-0.03em]">0 €</span>
                <span className="text-ink-soft">pendant la bêta</span>
              </p>
              <ul className="mt-6 space-y-3">
                {BETA_INCLUDES.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-body">
                    <Icon name="check" className="size-4 shrink-0 text-success" />
                    {item}
                  </li>
                ))}
              </ul>
              <PrimaryCta className="mt-8 w-full">Commencer gratuitement</PrimaryCta>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 border-t border-rule bg-sheet">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-5 py-20 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:py-28">
            <SectionHeading
              kicker="Questions"
              title="Ce qu'on nous demande."
              body={
                <>
                  Une autre question ?{" "}
                  <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-ink underline underline-offset-4">
                    Écrivez-nous
                  </a>
                  .
                </>
              }
            />
            <div className="divide-y divide-rule border-y border-rule">
              {FAQ.map((item) => (
                <details key={item.q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-body font-semibold [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full ring-1 ring-rule transition-transform duration-200 group-open:rotate-45">
                      <Icon name="plus" className="size-3.5" />
                    </span>
                  </summary>
                  <p className="mt-3 max-w-2xl text-body text-ink-soft">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto w-full max-w-6xl px-5 py-20 text-center sm:px-6 md:py-28">
          <h2 className="mx-auto max-w-2xl text-title font-medium [font-stretch:92%] sm:text-[2.75rem] sm:leading-[1.08]">
            Votre prochain devis peut partir avec un lien suivi.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-lg text-ink-soft">
            Créez votre compte avec votre email, ajoutez un PDF, envoyez le lien.
          </p>
          <PrimaryCta className="mt-9">Créer mon premier lien</PrimaryCta>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function SectionHeading({
  kicker,
  title,
  body,
}: {
  kicker: string;
  title: string;
  body?: React.ReactNode;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-small font-medium text-brand">{kicker}</p>
      <h2 className="mt-3 text-title font-medium [font-stretch:92%]">{title}</h2>
      {body && <p className="mt-4 text-lg leading-relaxed text-ink-soft">{body}</p>}
    </div>
  );
}
