// Copy for /fr/propale, the cold email campaign page. French only: the page has no English
// version, so it lives here instead of messages/<locale>.json (no fake English keys to keep in sync).
// Strings are plain text. <hot>…</hot> marks the highlighted words, as in home.hero.title.

/**
 * Mirrors the "cold-2026-11" entry of app/src/lib/billing/offers.ts (code and signupDeadline), copied by hand:
 * the landing doesn't import from the app. Keep both in sync. The app is the authority on the deadline.
 */
export const COLD_OFFER = {
  code: "cold-2026-11",
  deadline: new Date("2026-11-30T22:59:59Z"),
} as const;

export const PROPALE = {
  meta: {
    title: "Clozer · Sachez qui lit votre propale",
    description:
      "Envoyez un lien Clozer à la place du PDF. Vous voyez qui lit votre propale, quelles pages il relit, et quand relancer.",
  },
  hero: {
    kicker: "Pour les équipes commerciales B2B",
    title: "Votre propale est partie mardi. Depuis, elle a été lue <hot>4 fois</hot>. Vous ne le savez pas.",
    lead: "Envoyez un lien Clozer à la place du PDF. Vous voyez qui l'ouvre, les pages qu'il relit et à qui il le transfère. Clozer vous dit qui relancer ce matin et prépare le message.",
    cta: "Suivre ma prochaine propale",
  },
  // Shown until COLD_OFFER.deadline; offerExpired replaces it after.
  offer: {
    label: "Offre réservée aux personnes contactées par email",
    trial: "30 jours d'essai Équipe, sans carte bancaire.",
    discount: "-30\u00a0% pendant 12 mois si vous choisissez une formule avant la fin de l'essai. Solo ou Équipe, mensuel ou annuel.",
    earlyPay:
      "Vous pouvez choisir une formule dès le premier jour\u00a0: vous ne payez qu'à la fin de l'essai. Dans les deux derniers jours, la facturation démarre tout de suite.",
    deadline: "Inscription jusqu'au 30\u00a0novembre à 23\u00a0h\u00a059.",
  },
  offerExpired: {
    label: "Essayez Clozer",
    trial: "14 jours d'essai Équipe, sans carte bancaire.",
    note: "L'offre réservée aux personnes contactées par email a pris fin le 30\u00a0novembre.",
  },
  example: {
    kicker: "Exemple de lecture",
    title: "Ce que vous auriez vu depuis mardi.",
    verdict: "Chaud. À relancer ce matin.",
    note: "Exemple, données fictives",
  },
  gains: {
    kicker: "Ce que vous gagnez",
    title: "Vous relancez le jour où ça bouge.",
    items: [
      {
        title: "Relancer quand il relit",
        body: "Il rouvre les tarifs un jeudi soir, vous recevez une alerte. Le lendemain matin, la relance est écrite à partir de ce qu'il a lu. Vous la relisez, vous l'envoyez.",
      },
      {
        title: "Voir le deal monter chez le décideur",
        body: "Votre contact transfère la propale en interne\u00a0? Le nouveau lecteur apparaît, avec son nom ou son email et les pages qu'il a lues. Si quelqu'un à qui vous n'avez rien envoyé ouvre les tarifs, vous le voyez.",
      },
      {
        title: "Lâcher les deals morts",
        body: "Un lien jamais ouvert, une lecture arrêtée à la page 2\u00a0: la température le montre. Vous arrêtez de relancer dans le vide et vous gardez votre temps pour les deals chauds.",
      },
      {
        title: "Le rendez-vous se prend dans le document",
        body: "Le prospect réserve un créneau dans votre Calendly ou Cal.com sans quitter la propale. Vous êtes prévenu aussitôt, et les relances automatiques s'arrêtent. Il peut aussi valider et signer en bas du document.",
      },
    ],
  },
  manager: {
    kicker: "Pour le manager",
    title: "Le pipeline de chaque commercial, d'après ce que lisent ses prospects.",
    body: "Dans la vue Équipe, vous voyez les deals de chaque commercial et ce qui avance ou glisse. Un deal annoncé « quasi signé » en réunion, vous voyez si la propale a seulement été ouverte. L'essai est en Équipe\u00a0: invitez vos commerciaux dès le premier jour.",
  },
  faq: {
    kicker: "Questions",
    items: [
      {
        q: "Le prospect sait-il que sa lecture est suivie\u00a0? Et le RGPD\u00a0?",
        a: "Oui, il est informé. Une mention claire figure sur la page du document, avec un lien vers notre politique de confidentialité. Vos relances parlent de votre proposition, jamais d'une page ou d'un temps de lecture. Chaque relance a un lien de désinscription, et les adresses IP ne sont jamais stockées en clair.",
      },
      {
        q: "Ça marche avec Gmail et Outlook\u00a0?",
        a: "Oui. Sur Gmail et Outlook web, l'extension Chrome propose de remplacer le PDF joint par un lien au nom du destinataire. Pour Outlook installé, sur Windows et Mac, votre administrateur Microsoft 365 ajoute le complément pour toute l'équipe. Vous pouvez aussi copier le lien et le coller où vous voulez.",
      },
      {
        q: "Faut-il installer quelque chose\u00a0?",
        a: "Non. Vous vous connectez avec Google ou votre email, sans mot de passe, et votre prospect lit dans son navigateur. L'extension est un raccourci en option.",
      },
      {
        q: "Que se passe-t-il au bout des 30 jours\u00a0?",
        a: "Si vous n'avez pas choisi de formule, votre espace passe en Gratuit. Rien n'est prélevé, puisqu'aucune carte ne vous a été demandée. Vos liens continuent de marcher et aucune donnée n'est effacée.",
      },
      {
        q: "Si je choisis une formule pendant l'essai, je perds les jours restants\u00a0?",
        a: "Non. La facturation démarre à la fin des 30 jours, et les 12 mois à -30\u00a0% partent de là. Seule exception\u00a0: si vous choisissez dans les deux derniers jours de l'essai, la facturation démarre tout de suite.",
      },
      {
        q: "Et après les 12 mois\u00a0?",
        a: "Vous passez au prix normal, hors TVA\u00a0: 19\u00a0€ par mois en Solo, 39\u00a0€ par membre et par mois en Équipe, 2 membres minimum. En annuel, c'est 15\u00a0€ et 32\u00a0€ par mois, facturés une fois par an. Sans engagement\u00a0: vous résiliez depuis les réglages de facturation.",
      },
    ],
  },
  // The offer block (or offerExpired) sits next to this, so the lead stays true after the deadline.
  final: {
    title: "Votre prochaine propale, vous saurez qui la lit.",
    lead: "Connectez-vous avec Google ou votre email, sans mot de passe. Un tour guidé crée avec vous un premier lien de test.",
    cta: "Suivre ma prochaine propale",
  },
} as const;
