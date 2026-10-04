import type { FollowupChannel, FollowupSentVia, FollowupStatus, FollowupTrigger } from "@/generated/prisma/enums";

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
  edited: boolean;
  recipient: string;
  recipientEmail: string;
  linkName: string;
};

type FollowupRow = Omit<FollowupItem, "version" | "edited" | "recipient" | "recipientEmail" | "linkName"> & {
  updatedAt: Date;
  editedAt: Date | null;
  prospect: { name: string | null; email: string };
};

export function toFollowupItem(f: FollowupRow, linkName: string): FollowupItem {
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
    edited: f.editedAt !== null,
    recipient: f.prospect.name ?? f.prospect.email,
    recipientEmail: f.prospect.email,
    linkName,
  };
}
