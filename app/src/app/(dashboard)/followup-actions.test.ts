import { beforeEach, describe, expect, it, vi } from "vitest";

const linkFindFirst = vi.fn();
const linkFindUnique = vi.fn();
const linkUpdate = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: { link: { findFirst: linkFindFirst, findUnique: linkFindUnique, update: linkUpdate } },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => `t:${key}` }));
vi.mock("@/lib/session", () => ({
  requireWorkspace: async () => ({ organization: { id: "o1" }, role: "OWNER", scope: { userId: "u1", isOwner: true } }),
}));
vi.mock("@/lib/closing/followups/queue", () => ({
  cancelOpenFollowups: vi.fn(),
  OPEN_FOLLOWUP_STATUSES: [],
}));
vi.mock("@/lib/closing/dashboard/queries", () => ({ editableLinks: () => ({}), sellerLinks: () => ({}) }));
vi.mock("@/lib/closing/engagement/refresh-score", () => ({ refreshEngagementScore: vi.fn() }));
vi.mock("@/lib/closing/testing/time-travel", () => ({ shiftLinkBack: vi.fn() }));
vi.mock("@/lib/closing/engine", () => ({ runClosingTick: vi.fn() }));
vi.mock("@/lib/closing/expiry", () => ({ isLinkExpired: vi.fn() }));
vi.mock("@/lib/closing/followups/dispatch", () => ({ sendFollowup: vi.fn() }));
vi.mock("@/lib/closing/followups/review", () => ({
  approveFollowup: vi.fn(),
  markFollowupSentManually: vi.fn(),
  regenerateFollowup: vi.fn(),
  updateFollowupDraft: vi.fn(),
}));

const { toggleLinkFollowups } = await import("./followup-actions");

beforeEach(() => {
  vi.clearAllMocks();
  linkFindFirst.mockResolvedValue({ id: "l1", documentId: "d1" });
});

describe("toggleLinkFollowups", () => {
  it("refuses while a campaign owns the link, with a translated message", async () => {
    linkFindUnique.mockResolvedValue({ campaignOwned: true });
    expect(await toggleLinkFollowups("l1", true)).toEqual({ ok: false, error: "t:campaignOwned" });
    expect(linkUpdate).not.toHaveBeenCalled();
  });

  it("flips an ordinary link", async () => {
    linkFindUnique.mockResolvedValue({ campaignOwned: false });
    expect(await toggleLinkFollowups("l1", true)).toEqual({ ok: true });
    expect(linkUpdate).toHaveBeenCalledWith({ where: { id: "l1" }, data: { followupsEnabled: true } });
  });
});
