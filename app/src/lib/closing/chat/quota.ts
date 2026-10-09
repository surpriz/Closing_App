import { CHAT_IP_HOURLY_MAX, CHAT_VIEW_HOURLY_MAX, CHAT_VISITOR_DAILY_MAX } from "./constants";

/** Why a question is refused before reaching the model. Pure. */
export const CHAT_QUOTA_ERRORS = ["view_hourly", "visitor_daily", "ip_hourly", "workspace_daily"] as const;
export type ChatQuotaError = (typeof CHAT_QUOTA_ERRORS)[number];

export function decideChatQuota(input: {
  viewLastHour: number;
  visitorToday: number;
  ipLastHour: number;
  /** canChat: the workspace daily limit and the chat budget. */
  workspaceAllowed: boolean;
}): ChatQuotaError | null {
  if (input.viewLastHour >= CHAT_VIEW_HOURLY_MAX) return "view_hourly";
  if (input.visitorToday >= CHAT_VISITOR_DAILY_MAX) return "visitor_daily";
  if (input.ipLastHour >= CHAT_IP_HOURLY_MAX) return "ip_hourly";
  if (!input.workspaceAllowed) return "workspace_daily";
  return null;
}
