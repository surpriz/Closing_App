import type {
  DealStatus,
  EngagementTier,
  FollowupChannel,
  FollowupStatus,
  FollowupTrigger,
  PageTag,
  SellerAlertChannel,
  SellerAlertType,
} from "@/generated/prisma/enums";

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
  GENERATED: "Planifiée",
  SCHEDULED: "Planifiée",
  SENT: "Envoyée",
  DELIVERED: "Délivrée",
  FAILED: "Échec",
  CANCELLED: "Annulée",
  SKIPPED: "Ignorée",
};

export const FOLLOWUP_TRIGGER_LABELS: Record<FollowupTrigger, string> = {
  HOT_PRICING: "Relance à chaud · tarifs",
  ANTI_GHOSTING: "Anti-ghosting",
  MANUAL: "Manuelle",
};

export const CHANNEL_LABELS: Record<FollowupChannel, string> = {
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
};

export const ALERT_CHANNEL_LABELS: Record<SellerAlertChannel, string> = {
  EMAIL: "Email",
  SLACK: "Slack",
  WEBHOOK: "Webhook",
};

export const ALERT_TYPE_LABELS: Record<SellerAlertType, string> = {
  MULTI_VIEWER: "Lecture à plusieurs",
  REOPENED_AFTER_INACTIVITY: "Réouverture après inactivité",
};

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
