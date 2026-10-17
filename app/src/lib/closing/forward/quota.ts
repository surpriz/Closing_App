import {
  FORWARD_IP_HOURLY_MAX,
  FORWARD_LINK_DAILY_MAX,
  FORWARD_VISITOR_DAILY_MAX,
  FORWARD_WORKSPACE_DAILY_MAX,
} from "./limits";

/** Why a forward is not sent. "recipient_recent" is answered as sent: it already was. Pure. */
export type ForwardQuotaError = "recipient_recent" | "visitor_daily" | "ip_hourly" | "link_daily" | "workspace_daily";

export function decideForwardQuota(input: {
  recipientRecent: number;
  visitorToday: number;
  ipLastHour: number;
  linkToday: number;
  workspaceToday: number;
}): ForwardQuotaError | null {
  if (input.recipientRecent > 0) return "recipient_recent";
  if (input.visitorToday >= FORWARD_VISITOR_DAILY_MAX) return "visitor_daily";
  if (input.ipLastHour >= FORWARD_IP_HOURLY_MAX) return "ip_hourly";
  if (input.linkToday >= FORWARD_LINK_DAILY_MAX) return "link_daily";
  if (input.workspaceToday >= FORWARD_WORKSPACE_DAILY_MAX) return "workspace_daily";
  return null;
}
