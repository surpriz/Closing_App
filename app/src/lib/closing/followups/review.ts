import type { FollowupStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

import { generateFollowupMessage } from "./queue";

/**
 * What the seller does with a follow-up before it leaves: edit, approve,
 * ask for another version, or send it from their own mailbox.
 */

/** Written but not sent: the seller can still change it. */
const EDITABLE: FollowupStatus[] = ["DRAFT", "GENERATED", "SCHEDULED"];

export async function updateFollowupDraft(followupId: string, draft: { subject: string | null; body: string }) {
  const result = await prisma.followup.updateMany({
    where: { id: followupId, status: { in: EDITABLE } },
    // The seller read and rewrote it: the guard's "à relire" note is answered
    data: { subject: draft.subject, body: draft.body, editedAt: new Date(), error: null },
  });
  return result.count > 0;
}

/** DRAFT → GENERATED: the dispatcher sends it at its slot, or right away if the slot has passed. */
export async function approveFollowup(followupId: string, userId: string, now = new Date()) {
  const followup = await prisma.followup.findUnique({
    where: { id: followupId },
    select: { status: true, scheduledFor: true, body: true },
  });
  if (!followup || followup.status !== "DRAFT" || !followup.body) return false;

  const result = await prisma.followup.updateMany({
    where: { id: followupId, status: "DRAFT" },
    data: {
      status: "GENERATED",
      approvedAt: now,
      approvedById: userId,
      scheduledFor: followup.scheduledFor > now ? followup.scheduledFor : now,
    },
  });
  return result.count > 0;
}

/** The seller sent it themselves (mailto, copy-paste): keep it in the history, never send it again. */
export async function markFollowupSentManually(followupId: string, userId: string, now = new Date()) {
  const result = await prisma.followup.updateMany({
    where: { id: followupId, status: { in: EDITABLE } },
    data: { status: "SENT", sentVia: "MANUAL", sentAt: now, approvedAt: now, approvedById: userId, error: null },
  });
  return result.count > 0;
}

/** Throws the text away and writes it again, optionally with the seller's instruction. */
export async function regenerateFollowup(followupId: string, instruction: string | null) {
  const reset = await prisma.followup.updateMany({
    where: { id: followupId, status: { in: EDITABLE } },
    data: {
      status: "PENDING",
      subject: null,
      body: null,
      editedAt: null,
      approvedAt: null,
      approvedById: null,
      regenerateInstruction: instruction,
    },
  });
  if (reset.count === 0) return false;
  await generateFollowupMessage(followupId, instruction);
  return true;
}
