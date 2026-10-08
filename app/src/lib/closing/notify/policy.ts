import type { AlertPriority, SellerAlertChannel, SellerAlertType } from "@/generated/prisma/enums";

import { getLocalParts } from "../scheduling/business-hours";

/**
 * Which channels an alert goes to, for one seller. Pure.
 *
 * - ACTION (the prospect validated or asked for a change): always, day or night.
 * - CALL (reading right now): the extension first; email only when asked for
 *   and the extension is not running. Never outside working hours, at most a
 *   few per hour.
 * - INFO: working hours only, otherwise it waits for the morning digest.
 *
 * Slack and the outbound webhook are team channels set on the workspace.
 */

export const ALERT_PRIORITY: Record<SellerAlertType, AlertPriority> = {
  PROSPECT_VALIDATED: "ACTION",
  CHANGE_REQUESTED: "ACTION",
  CALL_MOMENT: "CALL",
  MULTI_VIEWER: "CALL",
  REOPENED_AFTER_INACTIVITY: "CALL",
  DRAFT_READY: "INFO",
};

export type SellerPrefs = {
  emailActions: boolean;
  emailCallMoments: boolean;
  extensionCallMoments: boolean;
  morningDigest: boolean;
  digestHour: number;
  timezone: string | null;
};

export const DEFAULT_PREFS: SellerPrefs = {
  emailActions: true,
  emailCallMoments: false,
  extensionCallMoments: true,
  morningDigest: true,
  digestHour: 8,
  timezone: null,
};

/** Seller local time when real-time CALL and INFO alerts may interrupt. */
export const WORKING_HOURS = { startHour: 8, endHour: 20, days: [1, 2, 3, 4, 5] } as const;
/** CALL alerts per seller per hour, beyond that the dashboard is enough. */
export const MAX_CALL_ALERTS_PER_HOUR = 4;
/** The extension counts as running when it polled this recently. */
export const EXTENSION_ACTIVE_MS = 3 * 60 * 1000;

export type ChannelDecision = {
  channels: SellerAlertChannel[];
  /** Why channels were left out, for logs and tests. */
  reason: "ok" | "quiet_hours" | "rate_limited" | "muted";
};

export function isWorkingTime(now: Date, timezone: string) {
  const local = getLocalParts(now, timezone);
  return (
    (WORKING_HOURS.days as readonly number[]).includes(local.weekday) &&
    local.hour >= WORKING_HOURS.startHour &&
    local.hour < WORKING_HOURS.endHour
  );
}

export function isExtensionActive(extensionSeenAt: Date | null, now: Date) {
  return !!extensionSeenAt && now.getTime() - extensionSeenAt.getTime() <= EXTENSION_ACTIVE_MS;
}

export function decideChannels(input: {
  type: SellerAlertType;
  prefs: SellerPrefs;
  /** WorkspaceSettings.alertChannels: only SLACK and WEBHOOK are read here. */
  workspaceChannels: SellerAlertChannel[];
  now: Date;
  timezone: string;
  extensionActive: boolean;
  /** CALL alerts this seller already got in the last hour. */
  recentCallAlerts: number;
}): ChannelDecision {
  const priority = ALERT_PRIORITY[input.type];
  const team = input.workspaceChannels.filter((c) => c === "SLACK" || c === "WEBHOOK");

  if (priority === "ACTION") {
    const channels: SellerAlertChannel[] = ["EXTENSION", ...team];
    if (input.prefs.emailActions) channels.unshift("EMAIL");
    return { channels, reason: "ok" };
  }

  if (!isWorkingTime(input.now, input.timezone)) return { channels: [], reason: "quiet_hours" };

  if (priority === "CALL") {
    if (input.recentCallAlerts >= MAX_CALL_ALERTS_PER_HOUR) return { channels: [], reason: "rate_limited" };
    const channels: SellerAlertChannel[] = [];
    if (input.prefs.extensionCallMoments) channels.push("EXTENSION");
    const extensionWillShow = input.prefs.extensionCallMoments && input.extensionActive;
    if (input.prefs.emailCallMoments && !extensionWillShow) channels.push("EMAIL");
    channels.push(...team);
    return { channels, reason: channels.length ? "ok" : "muted" };
  }

  // INFO: a draft waits. Same switch as the prospect actions, it needs the seller.
  const channels: SellerAlertChannel[] = input.prefs.emailActions ? ["EMAIL", ...team] : [...team];
  return { channels, reason: channels.length ? "ok" : "muted" };
}
