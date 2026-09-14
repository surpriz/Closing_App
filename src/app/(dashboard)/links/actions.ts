"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { DEAL_STATUS_LABELS } from "@/components/dashboard/labels";
import type { DealStatus } from "@/generated/prisma/enums";
import { refreshEngagementScore } from "@/lib/closing/engagement/refresh-score";
import { cancelOpenFollowups, isUniqueViolation } from "@/lib/closing/followups/queue";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/session";

export type LinkFormState = { ok?: boolean; error?: string } | null;

async function requireOwnedLink(linkId: string) {
  const { organization } = await requireWorkspace();
  const link = await prisma.link.findFirst({
    where: { id: linkId, organizationId: organization.id },
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

const nullableInt = (min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number().int().min(min).max(max).nullable());

const linkSettingsSchema = z
  .object({
    name: z.string().trim().max(120).transform((v) => v || null),
    requireEmail: checkbox,
    ctaEnabled: checkbox,
    followupsEnabled: checkbox,
    channels: z.array(z.enum(["EMAIL", "WHATSAPP"])),
    hotPricingThresholdSec: nullableInt(10, 3600),
    inactivityDays: z
      .string()
      .transform((v) =>
        [...new Set(v.split(/[,;\s]+/).filter(Boolean).map(Number))].sort((a, b) => a - b),
      )
      .pipe(z.array(z.number().int().min(1).max(60)).max(5)),
    businessHourStart: nullableInt(0, 23),
    businessHourEnd: nullableInt(1, 24),
  })
  .refine(
    (s) => s.businessHourStart === null || s.businessHourEnd === null || s.businessHourEnd > s.businessHourStart,
    { message: "L'heure de fin doit être après l'heure de début." },
  );

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
    channels: formData.getAll("channels"),
    hotPricingThresholdSec: String(formData.get("hotPricingThresholdSec") ?? ""),
    inactivityDays: String(formData.get("inactivityDays") ?? ""),
    businessHourStart: String(formData.get("businessHourStart") ?? ""),
    businessHourEnd: String(formData.get("businessHourEnd") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Réglages invalides." };
  }

  await prisma.link.update({ where: { id: link.id }, data: parsed.data });
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
