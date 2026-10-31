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

type LabelsTranslator = (key: string, values?: Record<string, string>) => string;

/** The sentence under a follow-up, from the `labels` translator. `seller` is the workspace sender name. */
export function followupSenderText(tl: LabelsTranslator, sender: FollowupSender, seller: string | null): string {
  switch (sender.kind) {
    case "manual":
      return tl("followupSender.manual");
    case "mailbox":
      return sender.mailbox
        ? tl("followupSender.mailbox", { mailbox: sender.mailbox, campaign: sender.campaign })
        : tl("followupSender.mailboxUnknown", { campaign: sender.campaign });
    default:
      return seller ? tl("followupSender.platformNamed", { seller }) : tl("followupSender.platform");
  }
}
