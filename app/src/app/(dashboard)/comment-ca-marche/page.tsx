import {
  BellRing,
  Eye,
  FileSearch,
  Gauge,
  type LucideIcon,
  MailCheck,
  PenLine,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader, SectionTitle, Surface } from "@/components/dashboard/page-header";

export const metadata: Metadata = { title: "Comment ça marche" };

const STEPS: { icon: LucideIcon; title: string; body: React.ReactNode }[] = [
  {
    icon: FileSearch,
    title: "Vous déposez un document",
    body: (
      <>
        Clozer le lit une fois pour toutes. Il reconnaît son type (devis, proposition, présentation, CV…), résume
        chaque page et repère où sont le prix, le planning, le périmètre ou vos références. Il note aussi les faits
        précis : « 12 000 € HT », « 8 semaines », « paiement en 3 fois ».
      </>
    ),
  },
  {
    icon: Eye,
    title: "Votre prospect ouvre son lien",
    body: (
      <>
        Il voit votre document normalement. Clozer note, page par page, combien de temps il y passe, quand, sur quel
        appareil, et si d&apos;autres personnes l&apos;ouvrent. Les aperçus automatiques (Slack, LinkedIn) et vos
        propres lectures ne comptent pas. Si vous êtes sur Clozer à ce moment-là, vous le voyez lire en direct.
      </>
    ),
  },
  {
    icon: Sparkles,
    title: "Il referme : Clozer lit le deal",
    body: (
      <>
        Quelques minutes après sa lecture, Clozer reconstitue l&apos;histoire du deal en faits datés (« dimanche 21 h,
        sur mobile, 3 min sur les tarifs, s&apos;arrête page 9 ») et une IA l&apos;interprète comme le ferait un
        commercial expérimenté : où en est le deal, ce qui coince (prix, décideur, timing…), ce qu&apos;il faut faire.
        Chaque conclusion cite les faits qui la justifient ; ce qui n&apos;est pas prouvé est écarté.
      </>
    ),
  },
  {
    icon: PenLine,
    title: "S'il faut relancer, Clozer écrit le message",
    body: (
      <>
        En votre nom, avec votre offre et les vrais chiffres du document, sur l&apos;angle qui compte pour ce
        prospect. Par exemple : « Si l&apos;enveloppe coince, on peut étaler le paiement, on en parle 15 minutes ? ».
        Jamais « j&apos;ai vu que vous avez regardé les prix » : le prospect ne doit pas se sentir observé.
      </>
    ),
  },
  {
    icon: Timer,
    title: "Il choisit le bon moment",
    body: (
      <>
        Jamais juste après une lecture (ça sentirait la surveillance), toujours aux heures de bureau du prospect, 3
        relances par mois au maximum, et rien juste après un échange que vous avez noté.
      </>
    ),
  },
  {
    icon: MailCheck,
    title: "Vous validez, ou il envoie seul",
    body: (
      <>
        Par défaut, la relance vous attend : un email vous prévient, vous la retrouvez dans « Relances à valider » sur
        le tableau de bord et sur la fiche du prospect. Vous la relisez, la retouchez ou la faites réécrire, puis vous
        validez. En mode automatique, seules les relances sûres partent seules. Les réponses du prospect arrivent dans
        votre boîte mail.
      </>
    ),
  },
  {
    icon: BellRing,
    title: "Et il continue de surveiller",
    body: (
      <>
        Silence de 3 jours, de 7 jours : il relit le deal et adapte la suite. Lien jamais ouvert : un rappel discret
        après quelques jours. Le prospect clique « Valider » ou « Demander un ajustement » : tout s&apos;arrête et vous
        êtes prévenu. Vous l&apos;avez eu au téléphone : notez l&apos;échange en un clic, Clozer en tient compte.
      </>
    ),
  },
];

const GUARDRAILS = [
  "Jamais d'allusion au fait que vous voyez ce qu'il lit : un contrôle bloque toute phrase qui le laisserait deviner.",
  "Jamais un chiffre ou une date absents de votre document : un contrôle vérifie chaque montant.",
  "3 relances par mois et par contact au maximum, espacées de quelques jours.",
  "Jamais dans les heures qui suivent une lecture, toujours aux heures de bureau du prospect.",
  "Une seule relance en préparation par deal : une analyse plus récente remplace l'ancienne.",
  "Vos notes privées sur un deal servent à l'analyse, jamais à la rédaction d'un message.",
];

function Step({ icon: Icon, title, body, index }: (typeof STEPS)[number] & { index: number }) {
  return (
    <li className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4">
      <span className="flex size-10 items-center justify-center rounded-full bg-foreground/[0.06]">
        <Icon className="size-[18px]" />
      </span>
      <div className="space-y-1 pt-1.5 pb-6">
        <h3 className="font-medium">
          <span className="text-muted-foreground tabular-nums">{index}. </span>
          {title}
        </h3>
        <p className="text-[15px] text-muted-foreground">{body}</p>
      </div>
    </li>
  );
}

export default function HowItWorksPage() {
  return (
    <div className="max-w-3xl space-y-12">
      <PageHeader
        title="Comment Clozer pense"
        description="Ce qui se passe derrière chaque lien que vous envoyez, et pourquoi vous n'avez presque rien à faire."
      />

      <section>
        <p className="text-[1.375rem] leading-snug font-medium tracking-[-0.01em] text-balance">
          Clozer voit comment votre prospect lit votre document, comprend où en est le deal comme le ferait un
          commercial expérimenté, et prépare la bonne relance au bon moment. Vous validez et vous appelez ceux qui sont
          prêts.
        </p>
      </section>

      <section>
        <SectionTitle hint="ce qui se passe quand vous envoyez un lien">Le parcours d&apos;un deal</SectionTitle>
        <ol>
          {STEPS.map((step, i) => (
            <Step key={step.title} {...step} index={i + 1} />
          ))}
        </ol>
      </section>

      <section>
        <SectionTitle>Deux indicateurs, deux questions</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Surface className="space-y-2 p-5">
            <p className="flex items-center gap-2 font-medium">
              <Gauge className="size-4" /> Température (sur 100)
            </p>
            <p className="text-[15px] text-muted-foreground">
              <span className="text-foreground">Combien il lit.</span> Calculée sans IA : lecture récente, temps passé,
              visites répétées, plusieurs lecteurs, tarifs lus, lecture jusqu&apos;au bout. Chaque point a sa raison,
              affichée sur la fiche.
            </p>
          </Surface>
          <Surface className="space-y-2 p-5">
            <p className="flex items-center gap-2 font-medium">
              <Sparkles className="size-4" /> Lecture IA (et sa fiabilité)
            </p>
            <p className="text-[15px] text-muted-foreground">
              <span className="text-foreground">Ce que ça veut dire.</span> L&apos;IA interprète : un prospect peut
              être « chaud » (beaucoup de lectures) avec une lecture IA prudente (lectures courtes, trop tôt pour
              conclure). La fiabilité dit à quel point l&apos;IA est sûre d&apos;elle : faible quand il y a peu de
              signaux.
            </p>
          </Surface>
        </div>
      </section>

      <section>
        <SectionTitle>Les règles qu&apos;il respecte toujours</SectionTitle>
        <Surface className="p-5">
          <ul className="space-y-2.5 text-[15px]">
            {GUARDRAILS.map((rule) => (
              <li key={rule} className="flex gap-2.5">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                {rule}
              </li>
            ))}
          </ul>
        </Surface>
      </section>

      <section>
        <SectionTitle>Ce que vous faites, vous</SectionTitle>
        <ol className="list-inside list-decimal space-y-1.5 text-[15px]">
          <li>
            Décrire votre offre une fois, dans les{" "}
            <Link href="/settings" className="underline underline-offset-4">
              Réglages
            </Link>{" "}
            (facultatif : Clozer la devine à partir de votre premier document).
          </li>
          <li>Déposer un document et créer un lien par prospect.</li>
          <li>Valider les relances proposées, et appeler quand Clozer vous le dit.</li>
          <li>Noter vos appels et réponses reçues, en un clic sur la fiche du prospect.</li>
        </ol>
      </section>

      <section>
        <SectionTitle>Sous le capot</SectionTitle>
        <div className="space-y-2 text-[15px] text-muted-foreground">
          <p>
            Deux modèles d&apos;IA d&apos;Anthropic. Claude Haiku, rapide, lit les documents et fait un second contrôle
            avant tout envoi automatique. Claude Sonnet, plus réfléchi, analyse chaque deal et rédige les relances.
          </p>
          <p>
            Aucune adresse email ni adresse IP n&apos;est envoyée à l&apos;IA : les lecteurs sont désignés par une
            lettre (lecteur A, lecteur B…). Une analyse n&apos;est relancée que s&apos;il s&apos;est passé quelque chose
            de nouveau.
          </p>
        </div>
      </section>

      <section>
        <SectionTitle>Ce qui n&apos;est pas encore là</SectionTitle>
        <ul className="list-inside list-disc space-y-1.5 text-[15px] text-muted-foreground">
          <li>Les relances partent de l&apos;adresse de Clozer, avec votre email en adresse de réponse.</li>
          <li>Clozer ne voit pas encore les réponses reçues par email : notez-les sur la fiche du prospect.</li>
          <li>Les relances WhatsApp arrivent bientôt.</li>
        </ul>
      </section>
    </div>
  );
}
