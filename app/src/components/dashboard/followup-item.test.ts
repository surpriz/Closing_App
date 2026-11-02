import { describe, expect, it } from "vitest";

import { toFollowupItem } from "./followup-item";

const base = {
  id: "f1",
  status: "DRAFT" as const,
  trigger: "COLD_READ_PRICING" as const,
  channel: "EMAIL" as const,
  scheduledFor: new Date("2026-10-30T08:12:00Z"),
  timezone: "Europe/Paris",
  subject: "Devis",
  body: "Bonjour",
  error: null,
  aiProvider: "anthropic",
  aiModel: null,
  rationale: null,
  confidence: null,
  sentAt: null,
  sentVia: null,
  updatedAt: new Date("2026-10-29T10:00:00Z"),
  editedAt: null,
  prospect: { name: "David", email: "david@example.com" },
};
const share = { url: "https://example.com/v/x", title: "Devis" };

describe("toFollowupItem", () => {
  it("sends a campaign draft from the campaign mailbox and flags it when that mailbox is down", () => {
    const item = toFollowupItem(
      { ...base, campaignProspect: { campaign: { name: "Waltio", mailbox: { email: "j@gmail.com", status: "ERROR" } } } },
      "Waltio",
      share,
    );
    expect(item.sender).toEqual({ kind: "mailbox", mailbox: "j@gmail.com", campaign: "Waltio" });
    expect(item.mailboxDown).toBe("j@gmail.com");
  });

  it("does not flag a working campaign mailbox", () => {
    const item = toFollowupItem(
      { ...base, campaignProspect: { campaign: { name: "Waltio", mailbox: { email: "j@gmail.com", status: "ACTIVE" } } } },
      "Waltio",
      share,
    );
    expect(item.mailboxDown).toBeNull();
  });

  it("sends a plain link draft from the platform", () => {
    const item = toFollowupItem({ ...base, campaignProspect: null }, "Acme", share);
    expect(item.sender).toEqual({ kind: "platform" });
    expect(item.mailboxDown).toBeNull();
  });
});
