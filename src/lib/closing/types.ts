import type {
  FollowupChannel,
  FollowupTrigger,
  SellerAlertChannel,
  SellerAlertType,
} from "@/generated/prisma/enums";

export type AiProvider = "openai" | "anthropic";

// Workspace defaults merged with link overrides
export type ResolvedFollowupSettings = {
  enabled: boolean;
  channels: FollowupChannel[];
  hotPricingThresholdSec: number;
  inactivityDays: number[];
  businessHourStart: number;
  businessHourEnd: number;
  businessDays: number[];
  multiViewerThreshold: number;
  reopenAfterInactivityDays: number;
  alertChannels: SellerAlertChannel[];
};

// Body sent by the viewer to /api/track on each flush
export type TrackingEvent = {
  viewId: string;
  pageNumber: number;
  durationMs: number;
  scrollDepth?: number;
};

export type EngagementReason = {
  code: string;
  weight: number;
  detail?: string;
};

// Trigger.dev task payloads
export type HotPricingPayload = {
  linkId: string;
  viewId: string;
  prospectId: string;
  pricingPages: number[];
  pricingDurationMs: number;
};

export type AntiGhostingPayload = {
  linkId: string;
  prospectId: string;
  daysSinceSent: number;
};

export type SendFollowupPayload = {
  followupId: string;
};

export type SellerAlertPayload = {
  linkId: string;
  type: SellerAlertType;
  liveViewers?: number;
  inactiveDays?: number;
};

export type FollowupRequest = {
  linkId: string;
  prospectId: string;
  trigger: FollowupTrigger;
  channel: FollowupChannel;
};
