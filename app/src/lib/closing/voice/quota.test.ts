import { describe, expect, it } from "vitest";

import { VOICE_IP_HOURLY_MAX, VOICE_VIEW_HOURLY_MAX, VOICE_VISITOR_DAILY_MAX } from "../media/limits";
import { decideVoiceQuota } from "./quota";

const ok = { viewLastHour: 0, visitorToday: 0, ipLastHour: 0 };

describe("decideVoiceQuota", () => {
  it("lets a voice comment through under every limit", () => {
    expect(decideVoiceQuota(ok)).toBeNull();
  });

  it("stops at the session, browser and network limits", () => {
    expect(decideVoiceQuota({ ...ok, viewLastHour: VOICE_VIEW_HOURLY_MAX })).toBe("view_hourly");
    expect(decideVoiceQuota({ ...ok, visitorToday: VOICE_VISITOR_DAILY_MAX })).toBe("visitor_daily");
    expect(decideVoiceQuota({ ...ok, ipLastHour: VOICE_IP_HOURLY_MAX })).toBe("ip_hourly");
  });
});
