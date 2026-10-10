import { VOICE_IP_HOURLY_MAX, VOICE_VIEW_HOURLY_MAX, VOICE_VISITOR_DAILY_MAX } from "../media/limits";

/** Why a voice comment is refused before it is stored. Pure. */
export type VoiceQuotaError = "view_hourly" | "visitor_daily" | "ip_hourly";

export function decideVoiceQuota(input: { viewLastHour: number; visitorToday: number; ipLastHour: number }): VoiceQuotaError | null {
  if (input.viewLastHour >= VOICE_VIEW_HOURLY_MAX) return "view_hourly";
  if (input.visitorToday >= VOICE_VISITOR_DAILY_MAX) return "visitor_daily";
  if (input.ipLastHour >= VOICE_IP_HOURLY_MAX) return "ip_hourly";
  return null;
}
