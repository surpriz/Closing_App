import { describe, expect, it } from "vitest";

import { followupSender, followupSenderText } from "./sender";

const campaign = { name: "Onboarding Waltio", mailbox: "j@gmail.com" };
const tl = (key: string, values?: Record<string, string>) =>
  `${key}${values ? ` ${JSON.stringify(values)}` : ""}`;

describe("followupSender", () => {
  it("is manual when the seller sent it themselves, campaign or not", () => {
    expect(followupSender({ sentVia: "MANUAL", campaign })).toEqual({ kind: "manual" });
  });

  it("is the campaign mailbox for a draft of a campaign link", () => {
    expect(followupSender({ sentVia: null, campaign })).toEqual({
      kind: "mailbox",
      mailbox: "j@gmail.com",
      campaign: "Onboarding Waltio",
    });
  });

  it("keeps the campaign without a mailbox email when the campaign lost its mailbox", () => {
    expect(followupSender({ sentVia: "MAILBOX", campaign: { ...campaign, mailbox: null } })).toEqual({
      kind: "mailbox",
      mailbox: null,
      campaign: "Onboarding Waltio",
    });
  });

  it("is the platform for a follow-up Clozer sent, even on a link a campaign once owned", () => {
    expect(followupSender({ sentVia: "PLATFORM", campaign })).toEqual({ kind: "platform" });
  });

  it("is the platform for a plain link draft", () => {
    expect(followupSender({ sentVia: null, campaign: null })).toEqual({ kind: "platform" });
  });
});

describe("followupSenderText", () => {
  it("names the seller when the workspace has a sender name", () => {
    expect(followupSenderText(tl, { kind: "platform" }, "Jérôme")).toBe(
      'followupSender.platformNamed {"seller":"Jérôme"}',
    );
  });

  it("falls back to 'in your name' without a sender name", () => {
    expect(followupSenderText(tl, { kind: "platform" }, null)).toBe("followupSender.platform");
  });

  it("names the mailbox and the campaign", () => {
    expect(followupSenderText(tl, { kind: "mailbox", mailbox: "j@gmail.com", campaign: "Waltio" }, null)).toBe(
      'followupSender.mailbox {"mailbox":"j@gmail.com","campaign":"Waltio"}',
    );
  });

  it("skips the mailbox when its email is unknown", () => {
    expect(followupSenderText(tl, { kind: "mailbox", mailbox: null, campaign: "Waltio" }, null)).toBe(
      'followupSender.mailboxUnknown {"campaign":"Waltio"}',
    );
  });

  it("says sent by you for a manual send", () => {
    expect(followupSenderText(tl, { kind: "manual" }, "Jérôme")).toBe("followupSender.manual");
  });
});
