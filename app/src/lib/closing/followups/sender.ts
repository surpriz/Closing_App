import type { FollowupSentVia } from "@/generated/prisma/enums";

/**
 * Who sends a follow-up, as the seller must read it: Clozer in their name (reply-to their address),
 * their own connected mailbox in the campaign thread, or themselves. Pure, shared by server and client.
 */
export type FollowupSender =
  | { kind: "platform" }
  | { kind: "mailbox"; mailbox: string | null; campaign: string }
  | { kind: "manual" };

export function followupSender(f: {
  sentVia: FollowupSentVia | null;
  campaign: { name: string; mailbox: string | null } | null;
}): FollowupSender {
  if (f.sentVia === "MANUAL") return { kind: "manual" };
  // Not sent yet: a campaign link's follow-up leaves from the campaign mailbox (followup-transport.ts)
  if (f.sentVia === "MAILBOX" || (f.sentVia === null && f.campaign)) {
    return { kind: "mailbox", mailbox: f.campaign?.mailbox ?? null, campaign: f.campaign?.name ?? "" };
  }
  return { kind: "platform" };
}

export type FollowupSenderKey = "platformNamed" | "platform" | "mailbox" | "mailboxUnknown" | "manual";

/**
 * The sentence under a follow-up: a `labels.followupSender.*` key and its values, so each caller uses
 * its own typed translator. `seller` is the workspace sender name, may be empty.
 */
export function followupSenderLabel(
  sender: FollowupSender,
  seller: string | null,
): { key: FollowupSenderKey; values: Record<string, string> } {
  switch (sender.kind) {
    case "manual":
      return { key: "manual", values: {} };
    case "mailbox":
      return sender.mailbox
        ? { key: "mailbox", values: { mailbox: sender.mailbox, campaign: sender.campaign } }
        : { key: "mailboxUnknown", values: { campaign: sender.campaign } };
    default:
      return seller ? { key: "platformNamed", values: { seller } } : { key: "platform", values: {} };
  }
}
