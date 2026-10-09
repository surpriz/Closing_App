import { describe, expect, it } from "vitest";

import { CHAT_IP_HOURLY_MAX, CHAT_VIEW_HOURLY_MAX, CHAT_VISITOR_DAILY_MAX } from "./constants";
import { decideChatQuota } from "./quota";

const ok = { viewLastHour: 0, visitorToday: 0, ipLastHour: 0, workspaceAllowed: true };

describe("decideChatQuota", () => {
  it("lets a question through under every limit", () => {
    expect(decideChatQuota(ok)).toBeNull();
  });

  it("stops at the session, browser, network and workspace limits", () => {
    expect(decideChatQuota({ ...ok, viewLastHour: CHAT_VIEW_HOURLY_MAX })).toBe("view_hourly");
    expect(decideChatQuota({ ...ok, visitorToday: CHAT_VISITOR_DAILY_MAX })).toBe("visitor_daily");
    expect(decideChatQuota({ ...ok, ipLastHour: CHAT_IP_HOURLY_MAX })).toBe("ip_hourly");
    expect(decideChatQuota({ ...ok, workspaceAllowed: false })).toBe("workspace_daily");
  });
});
