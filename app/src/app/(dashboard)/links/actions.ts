"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { DEAL_STATUS_LABELS } from "@/components/dashboard/labels";
import type { DealStatus } from "@/generated/prisma/enums";
import { inBackground } from "@/lib/closing/background";
import { actOnInsight } from "@/lib/closing/brain/act";
import { analyzeDeal } from "@/lib/closing/brain/analyze-deal";
import { refreshEngagementScore } from "@/lib/closing/engagement/refresh-score";
import { editableLinks } from "@/lib/closing/dashboard/queries";
import { cancelOpenFollowups, isUniqueViolation } from "@/lib/closing/followups/queue";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/session";

export type LinkFormState = { ok?: boolean; error?: string } | null;

// A teammate's deal can be opened, not changed: it reads as not found here
async function requireOwnedLink(linkId: string) {
  const workspace = await requireWorkspace();
  const link = await prisma.link.findFirst({
    where: { id: linkId, organizationId: workspace.organization.id, ...editableLinks(workspace) },
    select: { id: true, documentId: true },
  });
  if (!link) throw new Error("Lien introuvable");
  return link;
}

function revalidateLink(link: { id: string; documentId: string }) {
  revalidatePath(`/links/${link.id}`);
  revalidatePath(`/documents/${link.documentId}`);
  revalidatePath("/dashboard");
}

const dealStatusSchema = z.enum(["OPEN", "VALIDATED", "CHANGE_REQUESTED", "WON", "LOST"]);

export async function updateDealStatus(linkId: string, status: DealStatus) {
  const link = await requireOwnedLink(linkId);
  const dealStatus = dealStatusSchema.parse(status);

  await prisma.link.update({
    where: { id: link.id },
    data: { dealStatus, closedAt: dealStatus === "OPEN" ? null : new Date() },
  });
  // Automated follow-ups only make sense while the deal is still open
  if (dealStatus !== "OPEN") {
    await cancelOpenFollowups(link.id, `Statut passé à « ${DEAL_STATUS_LABELS[dealStatus]} »`);
  }
  await refreshEngagementScore(link.id);
  revalidateLink(link);
}

export async function archiveLink(linkId: string) {
  const link = await requireOwnedLink(linkId);
  await prisma.link.update({ where: { id: link.id }, data: { archivedAt: new Date() } });
  await cancelOpenFollowups(link.id, "Lien archivé");
  revalidateLink(link);
  redirect(`/documents/${link.documentId}`);
}

const checkbox = z.literal("on").optional().transform((v) => v === "on");

const linkSettingsSchema = z.object({
  name: z.string().trim().max(120).transform((v) => v || null),
  requireEmail: checkbox,
  ctaEnabled: checkbox,
  followupsEnabled: checkbox,
});

export async function saveLinkSettings(
  linkId: string,
  _prev: LinkFormState,
  formData: FormData,
): Promise<LinkFormState> {
  const link = await requireOwnedLink(linkId);

  const parsed = linkSettingsSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    requireEmail: formData.get("requireEmail") ?? undefined,
    ctaEnabled: formData.get("ctaEnabled") ?? undefined,
    followupsEnabled: formData.get("followupsEnabled") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Réglages invalides." };
  }

  await prisma.link.update({
    where: { id: link.id },
    // Per-link rule overrides belong to the rule engine the analysis replaced: back to the defaults
    data: {
      ...parsed.data,
      channels: [],
      hotPricingThresholdSec: null,
      inactivityDays: [],
      businessHourStart: null,
      businessHourEnd: null,
    },
  });
  if (!parsed.data.followupsEnabled) {
    await cancelOpenFollowups(link.id, "Relances désactivées sur ce lien");
  }

  revalidateLink(link);
  return { ok: true };
}

const prospectSchema = z
  .object({
    email: z.email().max(254).optional(),
    name: z.string().trim().max(120).transform((v) => v || null),
    company: z.string().trim().max(120).transform((v) => v || null),
    phone: z
      .string()
      .transform((v) => v.replace(/[\s.\-()]/g, ""))
      .refine((v) => v === "" || /^\+[1-9]\d{6,14}$/.test(v), {
        message: "Numéro au format international, ex : +33612345678",
      })
      .transform((v) => v || null),
    whatsappOptIn: checkbox,
  })
  .refine((p) => !p.whatsappOptIn || p.phone, {
    message: "Ajoutez un numéro pour activer WhatsApp.",
  });

// Creates a contact on the link (prospectId null) or updates an existing one
export async function saveProspect(
  linkId: string,
  prospectId: string | null,
  _prev: LinkFormState,
  formData: FormData,
): Promise<LinkFormState> {
  const link = await requireOwnedLink(linkId);

  const parsed = prospectSchema.safeParse({
    email: prospectId ? undefined : String(formData.get("email") ?? "").trim().toLowerCase(),
    name: String(formData.get("name") ?? ""),
    company: String(formData.get("company") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    whatsappOptIn: formData.get("whatsappOptIn") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Contact invalide." };
  }
  const { email, name, company, phone, whatsappOptIn } = parsed.data;

  if (prospectId) {
    const existing = await prisma.prospect.findFirst({
      where: { id: prospectId, linkId: link.id },
      select: { id: true, whatsappOptInAt: true },
    });
    if (!existing) return { error: "Contact introuvable." };

    await prisma.prospect.update({
      where: { id: existing.id },
      data: {
        name,
        company,
        phoneE164: phone,
        whatsappOptInAt: whatsappOptIn ? (existing.whatsappOptInAt ?? new Date()) : null,
      },
    });
  } else {
    if (!email) return { error: "Email requis." };
    try {
      await prisma.prospect.create({
        data: {
          linkId: link.id,
          email,
          name,
          company,
          phoneE164: phone,
          whatsappOptInAt: whatsappOptIn ? new Date() : null,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) return { error: "Ce contact existe déjà sur ce lien." };
      throw error;
    }
  }

  revalidateLink(link);
  return { ok: true };
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : new Date(`${v}T12:00:00Z`)))
  .refine((v) => v === null || !Number.isNaN(v.getTime()), { message: "Date invalide." });

const dealContextSchema = z.object({
  dealAmount: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s ]/g, "").replace(",", "."))
    .transform((v) => (v === "" ? null : Math.round(Number(v) * 100)))
    .pipe(z.number().int().min(0).max(2_000_000_000).nullable()),
  dealCurrency: z.enum(["EUR", "USD", "GBP", "CHF", "CAD"]),
  decisionDeadline: optionalDate,
  decisionMakerName: optionalText(120),
  decisionMakerRole: optionalText(120),
  sellerNotes: optionalText(2000),
});

// What the seller knows about the deal and the prospect can't see: amount, deadline, decision maker, notes
export async function saveDealContext(linkId: string, _prev: LinkFormState, formData: FormData): Promise<LinkFormState> {
  const link = await requireOwnedLink(linkId);
  const parsed = dealContextSchema.safeParse({
    dealAmount: String(formData.get("dealAmount") ?? ""),
    dealCurrency: String(formData.get("dealCurrency") ?? "EUR"),
    decisionDeadline: String(formData.get("decisionDeadline") ?? ""),
    decisionMakerName: String(formData.get("decisionMakerName") ?? ""),
    decisionMakerRole: String(formData.get("decisionMakerRole") ?? ""),
    sellerNotes: String(formData.get("sellerNotes") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Contexte invalide." };

  const { dealAmount, ...rest } = parsed.data;
  await prisma.link.update({ where: { id: link.id }, data: { ...rest, dealAmountCents: dealAmount } });
  inBackground("brain", () => analyzeDeal(link.id, "SELLER_UPDATE"));
  revalidateLink(link);
  return { ok: true };
}

const sellerActivitySchema = z.object({
  type: z.enum(["CALL", "EMAIL_REPLY_RECEIVED", "MEETING", "NOTE"]),
  note: optionalText(1000),
  occurredAt: z
    .string()
    .trim()
    .transform((v) => (v === "" ? new Date() : new Date(v)))
    .refine((v) => !Number.isNaN(v.getTime()), { message: "Date invalide." }),
});

// Calls, replies and meetings happen outside Clozer: without them the advice would be blind
export async function logSellerActivity(
  linkId: string,
  _prev: LinkFormState,
  formData: FormData,
): Promise<LinkFormState> {
  const link = await requireOwnedLink(linkId);
  const { user } = await requireWorkspace();
  const parsed = sellerActivitySchema.safeParse({
    type: String(formData.get("type") ?? ""),
    note: String(formData.get("note") ?? ""),
    occurredAt: String(formData.get("occurredAt") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Échange invalide." };
  if (parsed.data.occurredAt.getTime() > Date.now() + 60_000) return { error: "Cette date est dans le futur." };

  await prisma.sellerActivity.create({ data: { linkId: link.id, userId: user.id, ...parsed.data } });
  inBackground("brain", () => analyzeDeal(link.id, "SELLER_UPDATE"));
  revalidateLink(link);
  return { ok: true };
}

/** Pauses advice and automatic follow-ups until a date, or resumes them with null. */
export async function snoozeDeal(linkId: string, until: string | null) {
  const link = await requireOwnedLink(linkId);
  const date = until ? new Date(`${until}T08:00:00Z`) : null;
  if (date && (Number.isNaN(date.getTime()) || date.getTime() < Date.now())) {
    return { error: "Choisissez une date à venir." };
  }
  await prisma.link.update({ where: { id: link.id }, data: { snoozedUntil: date } });
  if (date) await cancelOpenFollowups(link.id, "Deal mis en pause par le vendeur");
  revalidateLink(link);
  return { ok: true };
}

/** "Réanalyser": a fresh reading even when nothing changed, at most every two minutes. */
export async function reanalyzeDeal(linkId: string) {
  const link = await requireOwnedLink(linkId);
  const recent = await prisma.dealInsight.findFirst({
    where: { linkId: link.id, model: { not: null }, createdAt: { gte: new Date(Date.now() - 2 * 60 * 1000) } },
    select: { id: true },
  });
  if (recent) return { error: "Analyse toute fraîche, réessayez dans deux minutes." };

  const outcome = await analyzeDeal(link.id, "MANUAL", { force: true });
  revalidateLink(link);
  const errors: Partial<Record<typeof outcome, string>> = {
    no_ai: "Aucune IA n'est configurée.",
    budget: "Quota d'analyses du jour atteint.",
    failed: "L'analyse a échoué, réessayez dans un moment.",
    skipped: "Ce deal n'est plus en cours.",
  };
  return errors[outcome] ? { error: errors[outcome] } : { ok: true };
}


/** "Préparer une relance": a draft from the latest analysis, whatever it recommended. The policy still applies. */
export async function prepareFollowupFromInsight(linkId: string) {
  const link = await requireOwnedLink(linkId);
  const insight = await prisma.dealInsight.findFirst({
    where: { linkId: link.id, model: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!insight) return { error: "Analysez d'abord ce deal." };

  const result = await actOnInsight(insight.id, { force: true });
  revalidateLink(link);
  return result.ok ? { ok: true } : { error: result.reasons.join(" ") || "Impossible de préparer une relance." };
}
