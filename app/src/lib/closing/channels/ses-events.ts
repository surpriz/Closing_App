import { z } from "zod";

import { prisma } from "@/lib/db";
import { addSuppression } from "@/lib/outreach/suppression";
import { toUiLocale } from "@/lib/seller-locale";
import { getNamespaceTranslator } from "@/lib/server-translator";

import { OPEN_FOLLOWUP_STATUSES } from "../followups/queue";
import { notifySeller } from "../notify/notify";
import { unsubscribeByToken, unsubscribeToken } from "../unsubscribe";

/**
 * What SES tells us about the emails Clozer sent to prospects, through the configuration set's SNS
 * destination: delivered, bounced for good, or marked as spam. Only follow-ups are matched (by the
 * SES message id stored at send time); other emails have no deal to update.
 */

const recipientSchema = z.object({ emailAddress: z.string(), diagnosticCode: z.string().nullish() });

// Event publishing sends `eventType`; the older identity notifications send `notificationType`
export const sesEventSchema = z
  .object({
    eventType: z.string().optional(),
    notificationType: z.string().optional(),
    mail: z.object({ messageId: z.string(), timestamp: z.string().optional() }),
    bounce: z
      .object({
        bounceType: z.string(),
        bounceSubType: z.string().nullish(),
        bouncedRecipients: z.array(recipientSchema),
        timestamp: z.string().optional(),
      })
      .nullish(),
    complaint: z.object({ complainedRecipients: z.array(recipientSchema), timestamp: z.string().optional() }).nullish(),
    delivery: z.object({ timestamp: z.string().optional() }).nullish(),
  })
  .transform((event) => ({ ...event, kind: event.eventType ?? event.notificationType ?? "" }));

export type SesEvent = z.infer<typeof sesEventSchema>;

export type SesOutcome = "delivered" | "bounced" | "soft_bounce" | "complaint" | "unknown_message" | "ignored";

function at(timestamp: string | undefined) {
  const date = timestamp ? new Date(timestamp) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

/** One line a seller can read: "550 5.1.1 user unknown" rather than the full SMTP transcript. */
export function bounceDetail(event: SesEvent) {
  const code = event.bounce?.bouncedRecipients[0]?.diagnosticCode?.replace(/\s+/g, " ").trim();
  const kind = [event.bounce?.bounceType, event.bounce?.bounceSubType].filter(Boolean).join(" / ");
  return (code || kind || "").slice(0, 300) || null;
}

export async function handleSesEvent(raw: unknown): Promise<SesOutcome> {
  const parsed = sesEventSchema.safeParse(raw);
  if (!parsed.success) return "ignored";
  const event = parsed.data;
  if (!["Delivery", "Bounce", "Complaint"].includes(event.kind)) return "ignored";

  const followup = await prisma.followup.findFirst({
    where: { providerMessageId: event.mail.messageId, channel: "EMAIL" },
    select: {
      id: true,
      linkId: true,
      status: true,
      prospect: {
        select: {
          id: true,
          email: true,
          name: true,
          link: { select: { organizationId: true, createdBy: { select: { locale: true } } } },
        },
      },
    },
  });
  if (!followup) return "unknown_message";
  const { prospect } = followup;

  if (event.kind === "Delivery") {
    await prisma.followup.updateMany({
      where: { id: followup.id, deliveredAt: null },
      data: { deliveredAt: at(event.delivery?.timestamp), ...(followup.status === "SENT" && { status: "DELIVERED" }) },
    });
    return "delivered";
  }

  if (event.kind === "Complaint") {
    // Marked as spam: as firm a "stop" as the unsubscribe link, prospecting opt-out included
    // Written before unsubscribeByToken, which adds an UNSUBSCRIBE row too: skipDuplicates keeps the first
    // reason, and COMPLAINT is the accurate one
    await addSuppression({
      organizationId: prospect.link.organizationId,
      email: prospect.email,
      reason: "COMPLAINT",
      source: "ses",
    });
    await unsubscribeByToken(unsubscribeToken({ kind: "prospect", id: prospect.id }));
    await prisma.prospect.updateMany({
      where: { id: prospect.id, complainedAt: null },
      data: { complainedAt: at(event.complaint?.timestamp) },
    });
    return "complaint";
  }

  // SES already retried a transient bounce (mailbox full, greylisting): the next follow-up may land
  if (event.bounce?.bounceType !== "Permanent") return "soft_bounce";

  const now = at(event.bounce.timestamp);
  const detail = bounceDetail(event);
  // Shown to the seller on the cancelled follow-ups
  const reason = getNamespaceTranslator(toUiLocale(prospect.link.createdBy?.locale), "server.followups.dispatch")("bounced");
  const sameAddress = {
    email: { equals: prospect.email, mode: "insensitive" as const },
    link: { organizationId: prospect.link.organizationId },
  };
  await prisma.$transaction([
    prisma.followup.update({ where: { id: followup.id }, data: { bouncedAt: now } }),
    // The address is wrong on every deal of this workspace, not just this one
    prisma.prospect.updateMany({
      where: { ...sameAddress, bouncedAt: null },
      data: { bouncedAt: now, bounceDetail: detail },
    }),
    prisma.followup.updateMany({
      where: { prospect: sameAddress, status: { in: [...OPEN_FOLLOWUP_STATUSES] } },
      data: { status: "CANCELLED", cancelledAt: now, error: reason },
    }),
  ]);
  // The cancellations are committed: a failed suppression write must not swallow the seller alert below
  try {
    await addSuppression({
      organizationId: prospect.link.organizationId,
      email: prospect.email,
      reason: "BOUNCE",
      source: "ses",
      detail,
    });
  } catch (error) {
    console.error("Could not suppress bounced address", error);
  }
  await notifySeller({
    linkId: followup.linkId,
    type: "EMAIL_BOUNCED",
    dedupeKey: `email_bounced:${prospect.id}`,
    payload: { prospectEmail: prospect.email, prospectName: prospect.name, detail: detail ?? undefined },
  });
  return "bounced";
}
