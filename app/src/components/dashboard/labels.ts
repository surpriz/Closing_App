import type {
  DealStatus,
  EngagementTier,
  FollowupChannel,
  FollowupStatus,
  FollowupTrigger,
  PageTag,
  ProspectRole,
  SellerActivityType,
  SellerAlertChannel,
  SellerAlertType,
} from "@/generated/prisma/enums";
import type { HealthSignal } from "@/lib/closing/dashboard/team";

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  OPEN: "En cours",
  VALIDATED: "Validé",
  CHANGE_REQUESTED: "Ajustement demandé",
  WON: "Gagné",
  LOST: "Perdu",
};

export const TAG_LABELS: Record<PageTag, string> = {
  PRICING: "Tarifs",
  TERMS: "Conditions",
  TIMELINE: "Planning",
  SCOPE: "Périmètre",
  TEAM: "Équipe",
  CASE_STUDY: "Références",
  OTHER: "Autre",
};

export const TIER_LABELS: Record<EngagementTier, string> = {
  HOT: "Chaud",
  WARM: "Tiède",
  COLD: "Froid",
};

export const FOLLOWUP_STATUS_LABELS: Record<FollowupStatus, string> = {
  PENDING: "Rédaction…",
  DRAFT: "À valider",
  GENERATED: "Planifiée",
  SCHEDULED: "Planifiée",
  SENT: "Envoyée",
  DELIVERED: "Délivrée",
  FAILED: "Échec",
  CANCELLED: "Annulée",
  SKIPPED: "Ignorée",
};

export const FOLLOWUP_TRIGGER_LABELS: Record<FollowupTrigger, string> = {
  HOT_PRICING: "Après lecture des tarifs",
  ANTI_GHOSTING: "Lien pas encore ouvert",
  MANUAL: "Relance manuelle",
  AI_DECISION: "Conseillée par l'analyse",
};

export const SELLER_ACTIVITY_LABELS: Record<SellerActivityType, string> = {
  CALL: "Appel",
  EMAIL_REPLY_RECEIVED: "Réponse reçue",
  MEETING: "Rendez-vous",
  NOTE: "Note",
  MANUAL_SEND: "Message envoyé",
};

export const CHANNEL_LABELS: Record<FollowupChannel, string> = {
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
};

export const ALERT_CHANNEL_LABELS: Record<SellerAlertChannel, string> = {
  EMAIL: "Email",
  SLACK: "Slack",
  WEBHOOK: "Webhook",
  EXTENSION: "Extension",
};

export const ALERT_TYPE_LABELS: Record<SellerAlertType, string> = {
  MULTI_VIEWER: "Lecture à plusieurs",
  REOPENED_AFTER_INACTIVITY: "Réouverture après inactivité",
  DRAFT_READY: "Relance prête à valider",
  PROSPECT_VALIDATED: "Proposition validée",
  CHANGE_REQUESTED: "Ajustement demandé",
  PROSPECT_QUESTION: "Question du prospect",
  CALL_MOMENT: "Moment d'appeler",
  COMMITTEE_LIVE: "Comité en lecture",
  NEW_READER: "Nouveau lecteur",
  DECISION_MAKER_DETECTED: "Décideur en lecture",
};

export const PROSPECT_ROLE_LABELS: Record<ProspectRole, string> = {
  DECISION_MAKER: "Décideur",
  FINANCE: "Finance / achats",
  TECHNICAL: "Technique",
  CHAMPION: "Champion",
  INFLUENCER: "Influenceur",
  OTHER: "Autre",
};

export const READER_ORIGIN_LABELS = {
  initial: "Destinataire",
  forwarded_internal: "Repartagé en interne",
  external: "Lecteur externe",
  anonymous: "Non identifié",
} as const;

export const SCORE_REASON_LABELS: Record<string, string> = {
  deal_validated: "Proposition validée",
  deal_lost: "Deal perdu",
  recent_activity_24h: "Lu dans les dernières 24 h",
  recent_activity_3d: "Lu ces 3 derniers jours",
  recent_activity_7d: "Lu cette semaine",
  reading_time: "Temps de lecture",
  first_visit: "Première visite",
  repeat_visits: "Visites répétées",
  multiple_viewers: "Plusieurs lecteurs",
  pricing_focus: "Longue lecture des tarifs",
  pricing_interest: "Lecture des tarifs",
  read_to_end: "Lu jusqu'au bout",
  read_halfway: "Lu à moitié",
  change_requested: "Ajustement demandé",
};

export const STAGE_LABELS: Record<string, string> = {
  NOT_ENGAGED: "Pas encore engagé",
  DISCOVERING: "Découvre l'offre",
  EVALUATING: "Évalue",
  NEGOTIATING: "Négocie",
  DECIDING: "Proche de la décision",
  STALLED: "Au point mort",
  LIKELY_LOST: "Probablement perdu",
};

export const MOMENTUM_LABELS: Record<string, string> = {
  RISING: "en hausse",
  STEADY: "stable",
  COOLING: "en baisse",
};

export const FRICTION_LABELS: Record<string, string> = {
  PRICE: "Prix",
  SCOPE: "Périmètre",
  TIMING: "Calendrier",
  DECISION_MAKER: "Décideur",
  COMPETITION: "Concurrence",
  TRUST: "Confiance",
  STALLED_AT_SECTION: "Bloque sur une partie",
  OTHER: "Autre",
};

export const INSIGHT_ACTION_LABELS: Record<string, string> = {
  send_followup: "Relancer par écrit",
  call: "Appeler",
  reply_to_request: "Répondre à sa demande",
  involve_decision_maker: "Faire entrer le décideur dans la boucle",
  wait: "Attendre",
  close_lost: "Classer le deal",
};

export const TIMING_LABELS: Record<string, string> = {
  now: "maintenant",
  next_business_morning: "demain matin",
  in_2_business_days: "d'ici 2 jours ouvrés",
  in_1_week: "dans une semaine",
  before_deadline: "avant l'échéance",
};

export const FOLLOWUP_GOAL_LABELS: Record<string, string> = {
  gentle_reminder: "Petit rappel",
  clarify_pricing: "Clarifier le budget",
  propose_call: "Proposer un échange",
  address_objection: "Lever une objection",
  share_case_study: "Partager une référence",
  involve_decision_maker: "Impliquer le décideur",
  reactivate: "Relancer la discussion",
};

export const ROLE_LABELS = {
  owner: "Propriétaire",
  admin: "Admin",
  member: "Membre",
} as const;

const dayFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

/** Why a deal sits in its column on the team page. */
export function describeHealthSignal(signal: HealthSignal) {
  switch (signal.code) {
    case "reading_now":
      return "Lit en ce moment";
    case "change_requested":
      return "Ajustement demandé";
    case "tier_hot":
      return "Score chaud";
    case "ai_priority":
      return "Prioritaire selon l'analyse";
    case "pricing_focus":
      return "Longue lecture des tarifs";
    case "cooling":
      return "Intérêt en baisse";
    case "quiet":
      return `Plus lu depuis ${signal.days} j`;
    case "unopened":
      return `Pas ouvert depuis ${signal.days} j`;
    case "ai_likely_lost":
      return "Probablement perdu selon l'analyse";
    case "ai_stalled":
      return "Au point mort selon l'analyse";
    case "ai_close_lost":
      return "L'analyse conseille de le classer";
    case "never_opened":
      return `Jamais ouvert en ${signal.days} j`;
    case "silent":
      return `Plus lu depuis ${signal.days} j`;
    case "deadline_passed":
      return `Échéance passée (${dayFormat.format(signal.date)})`;
  }
}
