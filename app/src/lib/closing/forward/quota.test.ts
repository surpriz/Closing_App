import { describe, expect, it } from "vitest";

import {
  FORWARD_IP_HOURLY_MAX,
  FORWARD_LINK_DAILY_MAX,
  FORWARD_VISITOR_DAILY_MAX,
  FORWARD_WORKSPACE_DAILY_MAX,
} from "./limits";
import { decideForwardQuota } from "./quota";

const ok = { recipientRecent: 0, visitorToday: 0, ipLastHour: 0, linkToday: 0, workspaceToday: 0 };

describe("decideForwardQuota", () => {
  it("lets a forward through under every limit", () => {
    expect(decideForwardQuota(ok)).toBeNull();
  });

  it("treats a second forward to the same address as already sent", () => {
    expect(decideForwardQuota({ ...ok, recipientRecent: 1, visitorToday: FORWARD_VISITOR_DAILY_MAX })).toBe("recipient_recent");
  });

  it("stops at the browser, network, link and workspace limits", () => {
    expect(decideForwardQuota({ ...ok, visitorToday: FORWARD_VISITOR_DAILY_MAX })).toBe("visitor_daily");
    expect(decideForwardQuota({ ...ok, ipLastHour: FORWARD_IP_HOURLY_MAX })).toBe("ip_hourly");
    expect(decideForwardQuota({ ...ok, linkToday: FORWARD_LINK_DAILY_MAX })).toBe("link_daily");
    expect(decideForwardQuota({ ...ok, workspaceToday: FORWARD_WORKSPACE_DAILY_MAX })).toBe("workspace_daily");
  });
});
