import type { FollowupChannel, FollowupSentVia, FollowupStatus, FollowupTrigger, MailboxStatus } from "@/generated/prisma/enums";
import { followupSender, type FollowupSender } from "@/lib/closing/followups/sender";
import type { TitledLink } from "@/lib/text-html";

export type FollowupItem = {
  id: string;
  /** Changes on every save: remounts the draft fields so they show the stored text. */
  version: string;
  status: FollowupStatus;
  trigger: FollowupTrigger;
  channel: FollowupChannel;
  scheduledFor: Date;
  timezone: string;
  subject: string | null;
  body: string | null;
  error: string | null;
  aiProvider: string | null;
  aiModel: string | null;
  rationale: string | null;
  /** 0-100, follow-ups decided by the deal analysis only. */
  confidence: number | null;
  sentAt: Date | null;
  sentVia: FollowupSentVia | null;
  /** Who sends it, as the seller reads it: Clozer, their campaign mailbox, or themselves. */
  sender: FollowupSender;
  /** The campaign mailbox it depends on is in error: that address, else null. */
  mailboxDown: string | null;
  edited: boolean;
  recipient: string;
  recipientEmail: string;
  linkName: string;
  /** The proposal the message points to: copied, its address reads as this title. */
  share: TitledLink;
};

type FollowupRow = Omit<
  FollowupItem,
  "version" | "edited" | "recipient" | "recipientEmail" | "linkName" | "share" | "sender" | "mailboxDown"
> & {
  updatedAt: Date;
  editedAt: Date | null;
  prospect: { name: string | null; email: string };
  campaignProspect: { campaign: { name: string; mailbox: { email: string; status: MailboxStatus } | null } } | null;
};

/** What `toFollowupItem` reads from a campaign follow-up, ready to spread into a Prisma followup include. */
export const followupCampaignInclude = {
  campaignProspect: {
    select: { campaign: { select: { name: true, mailbox: { select: { email: true, status: true } } } } },
  },
} as const;

export function toFollowupItem(f: FollowupRow, linkName: string, share: TitledLink): FollowupItem {
  const campaign = f.campaignProspect?.campaign ?? null;
  const sender = followupSender({
    sentVia: f.sentVia,
    campaign: campaign ? { name: campaign.name, mailbox: campaign.mailbox?.email ?? null } : null,
  });
  return {
    id: f.id,
    version: f.updatedAt.toISOString(),
    status: f.status,
    trigger: f.trigger,
    channel: f.channel,
    scheduledFor: f.scheduledFor,
    timezone: f.timezone,
    subject: f.subject,
    body: f.body,
    error: f.error,
    aiProvider: f.aiProvider,
    aiModel: f.aiModel,
    rationale: f.rationale,
    confidence: f.confidence,
    sentAt: f.sentAt,
    sentVia: f.sentVia,
    sender,
    mailboxDown: sender.kind === "mailbox" && campaign?.mailbox?.status === "ERROR" ? campaign.mailbox.email : null,
    edited: f.editedAt !== null,
    recipient: f.prospect.name ?? f.prospect.email,
    recipientEmail: f.prospect.email,
    linkName,
    share,
  };
}
