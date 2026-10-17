"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import type { DealStatus, ProspectRole } from "@/generated/prisma/enums";
import { inBackground } from "@/lib/closing/background";
import { actOnInsight } from "@/lib/closing/brain/act";
import { analyzeDeal } from "@/lib/closing/brain/analyze-deal";
import { BOOKING_URL_ERROR, parseOptionalBookingUrl } from "@/lib/closing/booking/url";
import { editableLinks } from "@/lib/closing/dashboard/queries";
import { applyDealStatus } from "@/lib/closing/deals/status";
import { confirmLinkSent, forgetDraftCopied, markDraftCopied } from "@/lib/closing/documents/create-link";
import { linkDefaultsFor, SHARED_LINK_SETTINGS } from "@/lib/closing/documents/smart-defaults";
import { getSellerPrefs, sellerTimezone } from "@/lib/closing/notify/preferences";
import { getWorkspaceSettings } from "@/lib/closing/settings";
import { EXTENSION_DAYS, expiryError, extendExpiry, reactivates } from "@/lib/closing/expiry";
import { cancelOpenFollowups, isUniqueViolation } from "@/lib/closing/followups/queue";
import { prospectFromRecipient } from "@/lib/closing/prospects/from-recipient";
import { notifyReactivated } from "@/lib/closing/reactivation";
import { parseShareRecipient } from "@/lib/closing/share/compose";
import { onLinkExpiryChanged } from "@/lib/closing/triggers/expiry";
import { prisma } from "@/lib/db";
import { isManagerRole } from "@/lib/roles";
import { requireWorkspace } from "@/lib/session";

export type LinkFormState = { ok?: boolean; error?: string } | null;
/** `told`: prospects emailed because the link opened again. */
export type ExpiryChangeResult = { ok: true; told: number } | { error: string };

// A teammate's deal can be opened, not changed: it reads as not found here
async function requireOwnedLink(linkId: string) {
  const workspace = await requireWorkspace();
  const link = await prisma.link.findFirst({
    where: { id: linkId, organizationId: workspace.organization.id, ...editableLinks(workspace) },
    select: { id: true, documentId: true, expiresAt: true, shared: true, organizationId: true },
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
  await applyDealStatus(link.id, dealStatusSchema.parse(status));
  revalidateLink(link);
}

const prospectRoleSchema = z.enum(["DECISION_MAKER", "FINANCE", "TECHNICAL", "CHAMPION", "INFLUENCER", "OTHER"]).nullable();

/** The seller's word on who a contact is; null goes back to the guess from the email. */
export async function setProspectRole(linkId: string, prospectId: string, role: ProspectRole | null) {
  const link = await requireOwnedLink(linkId);
  const parsed = prospectRoleSchema.parse(role);
  const prospect = await prisma.prospect.findFirst({ where: { id: prospectId, linkId: link.id }, select: { id: true } });
  if (!prospect) throw new Error("Contact introuvable");

  await prisma.prospect.update({ where: { id: prospect.id }, data: { role: parsed } });
  revalidateLink(link);
}

export async function archiveLink(linkId: string) {
  const link = await requireOwnedLink(linkId);
  const now = new Date();
  // A shared link's readers lose access with it
  const readers = await prisma.link.findMany({ where: { parentLinkId: link.id, archivedAt: null }, select: { id: true } });
  await prisma.link.updateMany({ where: { id: { in: [link.id, ...readers.map((r) => r.id)] } }, data: { archivedAt: now } });
  for (const id of [link.id, ...readers.map((r) => r.id)]) await cancelOpenFollowups(id, "archived");
  revalidateLink(link);
  redirect(`/documents/${link.documentId}`);
}

const checkbox = z.literal("on").optional().transform((v) => v === "on");

/**
 * The single place a deadline changes: stale reminders go, the analysis looks
 * again, and whoever asked for more time hears the link opens again.
 * Returns how many prospects were told.
 */
async function applyExpiryChange(link: { id: string; expiresAt: Date | null }, next: Date | null, now: Date) {
  if (link.expiresAt?.getTime() === next?.getTime()) return 0;
  // The seller chose: the document type no longer moves it
  await prisma.link.update({ where: { id: link.id }, data: { expiresAt: next, autoSettings: false } });
  await onLinkExpiryChanged(link.id, now);
  // A shared link's readers keep its deadline, unless the seller gave one of them their own
  const readers = await prisma.link.findMany({
    where: { parentLinkId: link.id, archivedAt: null, expiresAt: link.expiresAt },
    select: { id: true },
  });
  if (readers.length > 0) {
    await prisma.link.updateMany({ where: { id: { in: readers.map((r) => r.id) } }, data: { expiresAt: next } });
    for (const reader of readers) await onLinkExpiryChanged(reader.id, now);
  }
  return reactivates(link.expiresAt, next, now) ? notifyReactivated(link.id, link.expiresAt!) : 0;
}

/** An ISO date computed in the seller's browser time zone, or null to remove the deadline. */
export async function setLinkExpiry(linkId: string, expiresAt: string | null): Promise<ExpiryChangeResult> {
  const link = await requireOwnedLink(linkId);
  const now = new Date();
  const date = expiresAt ? new Date(expiresAt) : null;
  const error = date && expiryError(date, now);
  if (error) return { error: (await getTranslations("deal.actions"))(error) };
  const told = await applyExpiryChange(link, date, now);
  revalidateLink(link);
  return { ok: true, told };
}

/** "+3 j", "+7 j", "+14 j": from the current deadline, or from now once it has passed. */
export async function extendLink(linkId: string, days: number): Promise<ExpiryChangeResult> {
  const link = await requireOwnedLink(linkId);
  if (!(EXTENSION_DAYS as readonly number[]).includes(days)) {
    const t = await getTranslations("deal.actions");
    return { error: t("invalidDuration") };
  }
  const now = new Date();
  const told = await applyExpiryChange(link, extendExpiry(link.expiresAt, now, days), now);
  revalidateLink(link);
  return { ok: true, told };
}

const LINK_SWITCHES = [
  "requireEmail",
  "ctaEnabled",
  "bookingEnabled",
  "chatEnabled",
  "voiceCommentsEnabled",
  "translationEnabled",
  "followupsEnabled",
] as const;
export type LinkSwitch = (typeof LINK_SWITCHES)[number];

/** One switch of the settings panel, saved as soon as it flips. */
export async function setLinkSwitch(linkId: string, key: LinkSwitch, value: boolean) {
  const link = await requireOwnedLink(linkId);
  const field = z.enum(LINK_SWITCHES).parse(key);
  // The email is how each reader of a shared link gets their own link
  if (link.shared && field === "requireEmail" && !value) {
    const t = await getTranslations("deal.actions");
    return { error: t("sharedNeedsEmail") };
  }
  await prisma.link.update({
    where: { id: link.id },
    // Per-link rule overrides belong to the rule engine the analysis replaced: back to the defaults
    data: {
      [field]: value === true,
      autoSettings: false,
      channels: [],
      hotPricingThresholdSec: null,
      inactivityDays: [],
      businessHourStart: null,
      businessHourEnd: null,
    },
  });
  if (field === "followupsEnabled" && !value) {
    await cancelOpenFollowups(link.id, "followupsOff");
  }
  revalidateLink(link);
  return { ok: true };
}

/** "Lien de rendez-vous" of the settings panel. Empty = the seller's own page. */
export async function setLinkBookingUrl(linkId: string, value: string) {
  const link = await requireOwnedLink(linkId);
  const bookingUrl = parseOptionalBookingUrl(value);
  if (bookingUrl === undefined) return { error: BOOKING_URL_ERROR };
  await prisma.link.update({ where: { id: link.id }, data: { bookingUrl } });
  revalidateLink(link);
  return { ok: true, bookingUrl };
}

export async function renameLink(linkId: string, name: string) {
  const link = await requireOwnedLink(linkId);
  const parsed = z.string().trim().max(120).safeParse(name);
  if (!parsed.success) {
    const t = await getTranslations("deal.actions");
    return { error: t("nameTooLong") };
  }
  await prisma.link.update({ where: { id: link.id }, data: { name: parsed.data || null } });
  revalidateLink(link);
  return { ok: true };
}

/**
 * "Une personne" / "Plusieurs personnes" on the share screen. Back to personal,
 * the link takes the usual settings of its document type again.
 */
export async function setLinkShared(linkId: string, shared: boolean) {
  const link = await requireOwnedLink(linkId);
  if (link.shared === shared) return { ok: true };
  if (shared) {
    // Only a fresh link: one already read or answered is a deal under way
    const [named, read, current] = await Promise.all([
      prisma.prospect.count({ where: { linkId: link.id, origin: "SELLER" } }),
      prisma.documentView.count({ where: { linkId: link.id, isBot: false } }),
      prisma.link.findUniqueOrThrow({ where: { id: link.id }, select: { dealStatus: true } }),
    ]);
    if (named > 0 || read > 0 || current.dealStatus !== "OPEN") {
      const t = await getTranslations("deal.actions");
      return { error: t("alreadyForContact") };
    }
  }

  const { user } = await requireWorkspace();
  const [document, settings, prefs] = await Promise.all([
    prisma.document.findUniqueOrThrow({ where: { id: link.documentId }, select: { docType: true, kind: true } }),
    getWorkspaceSettings(link.organizationId),
    getSellerPrefs(user.id, link.organizationId),
  ]);
  const personal = linkDefaultsFor(document.docType, settings, new Date(), sellerTimezone(prefs), {
    allowShared: false,
    kind: document.kind,
  });
  await prisma.link.update({
    where: { id: link.id },
    // The other settings stay: on a shared link they are what every reader's link starts from
    data: shared
      ? { ...SHARED_LINK_SETTINGS, autoSettings: false }
      : {
          shared: false,
          requireEmail: personal.requireEmail,
          ctaEnabled: personal.ctaEnabled,
          followupsEnabled: personal.followupsEnabled,
          autoSettings: false,
        },
  });
  revalidateLink(link);
  return { ok: true };
}

/** "Copier" or "Envoyer par email" on the share screen: the draft becomes a deal. */
export async function markLinkSent(linkId: string) {
  const { organization } = await requireWorkspace();
  const link = await requireOwnedLink(linkId);
  await confirmLinkSent({ organizationId: organization.id, linkId: link.id });
  revalidateLink(link);
}

/** Copied, or handed to the mail client: maybe sent, not confirmed. */
export async function markLinkCopied(linkId: string) {
  const link = await requireOwnedLink(linkId);
  await markDraftCopied(link.id);
  revalidateLink(link);
}

/** "Retirer" on a link never sent: a duplicate or a test, gone without leaving Aujourd'hui. */
export async function discardDraftLink(linkId: string) {
  const link = await requireOwnedLink(linkId);
  await prisma.link.updateMany({
    where: { id: link.id, draftAt: { not: null } },
    data: { archivedAt: new Date() },
  });
  revalidateLink(link);
  revalidatePath("/dashboard");
}

/** "Pas encore" to "Avez-vous envoyé le lien ?": back to a ready link, no more question. */
export async function markLinkNotSent(linkId: string) {
  const link = await requireOwnedLink(linkId);
  await forgetDraftCopied(link.id);
  revalidateLink(link);
}

/** The "Pour qui ?" field: an address adds the contact, a name only labels the link. */
export async function setLinkRecipient(linkId: string, raw: string): Promise<LinkFormState> {
  const link = await requireOwnedLink(linkId);
  const t = await getTranslations("deal.actions");
  // Its readers come through the gate: a named contact would be greeted to every one of them
  if (link.shared) return { error: t("sharedNoRecipient") };
  const { email, label } = parseShareRecipient(raw);
  if (!email && !label) return { error: t("emailOrName") };

  const prospect = email ? prospectFromRecipient({ email, displayName: label }) : null;
  if (email && !prospect) return { error: t("invalidEmail") };
  if (prospect) {
    await prisma.prospect.upsert({
      where: { linkId_email: { linkId: link.id, email: prospect.email } },
      create: { linkId: link.id, ...prospect },
      update: {},
    });
  }
  await prisma.link.update({
    where: { id: link.id },
    data: { name: prospect ? prospect.company || prospect.name || prospect.email : label },
  });
  revalidateLink(link);
  return { ok: true };
}

/** "Garder ces réglages pour mes prochains liens". Managers only: they are the workspace's. */
export async function saveAsWorkspaceDefaults(linkId: string) {
  const link = await requireOwnedLink(linkId);
  const { organization, role } = await requireWorkspace();
  const t = await getTranslations("deal.actions");
  if (!isManagerRole(role)) return { error: t("adminsOnlyDefaults") };
  // The forced email gate would become everyone's default
  if (link.shared) return { error: t("fromPersonalLink") };

  const current = await prisma.link.findUniqueOrThrow({
    where: { id: link.id },
    select: { requireEmail: true, chatEnabled: true, voiceCommentsEnabled: true, followupsEnabled: true },
  });
  await prisma.workspaceSettings.upsert({
    where: { organizationId: organization.id },
    create: {
      organizationId: organization.id,
      requireEmailByDefault: current.requireEmail,
      chatEnabledByDefault: current.chatEnabled,
      voiceCommentsByDefault: current.voiceCommentsEnabled,
      followupsByDefault: current.followupsEnabled,
    },
    update: {
      requireEmailByDefault: current.requireEmail,
      chatEnabledByDefault: current.chatEnabled,
      voiceCommentsByDefault: current.voiceCommentsEnabled,
      followupsByDefault: current.followupsEnabled,
    },
  });
  revalidatePath("/settings");
  return { ok: true };
}

type ActionsT = Awaited<ReturnType<typeof getTranslations<"deal.actions">>>;

const prospectSchema = (t: ActionsT) =>
  z
  .object({
    email: z.email().max(254).optional(),
    name: z.string().trim().max(120).transform((v) => v || null),
    company: z.string().trim().max(120).transform((v) => v || null),
    phone: z
      .string()
      .transform((v) => v.replace(/[\s.\-()]/g, ""))
      .refine((v) => v === "" || /^\+[1-9]\d{6,14}$/.test(v), {
        message: t("phoneFormat"),
      })
      .transform((v) => v || null),
    whatsappOptIn: checkbox,
  })
  .refine((p) => !p.whatsappOptIn || p.phone, {
    message: t("whatsappNeedsPhone"),
  });

// Creates a contact on the link (prospectId null) or updates an existing one
export async function saveProspect(
  linkId: string,
  prospectId: string | null,
  _prev: LinkFormState,
  formData: FormData,
): Promise<LinkFormState> {
  const link = await requireOwnedLink(linkId);
  const t = await getTranslations("deal.actions");

  const parsed = prospectSchema(t).safeParse({
    email: prospectId ? undefined : String(formData.get("email") ?? "").trim().toLowerCase(),
    name: String(formData.get("name") ?? ""),
    company: String(formData.get("company") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    whatsappOptIn: formData.get("whatsappOptIn") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("invalidContact") };
  }
  const { email, name, company, phone, whatsappOptIn } = parsed.data;

  if (prospectId) {
    const existing = await prisma.prospect.findFirst({
      where: { id: prospectId, linkId: link.id },
      select: { id: true, whatsappOptInAt: true },
    });
    if (!existing) return { error: t("contactNotFound") };

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
    if (!email) return { error: t("emailRequired") };
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
      if (isUniqueViolation(error)) return { error: t("contactExists") };
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

const optionalDate = (t: ActionsT) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : new Date(`${v}T12:00:00Z`)))
    .refine((v) => v === null || !Number.isNaN(v.getTime()), { message: t("invalidDate") });

const dealContextSchema = (t: ActionsT) =>
  z.object({
  dealAmount: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s ]/g, "").replace(",", "."))
    .transform((v) => (v === "" ? null : Math.round(Number(v) * 100)))
    .pipe(z.number().int().min(0).max(2_000_000_000).nullable()),
  dealCurrency: z.enum(["EUR", "USD", "GBP", "CHF", "CAD"]),
  decisionDeadline: optionalDate(t),
  decisionMakerName: optionalText(120),
  decisionMakerRole: optionalText(120),
  sellerNotes: optionalText(2000),
});

// What the seller knows about the deal and the prospect can't see: amount, deadline, decision maker, notes
export async function saveDealContext(linkId: string, _prev: LinkFormState, formData: FormData): Promise<LinkFormState> {
  const link = await requireOwnedLink(linkId);
  const t = await getTranslations("deal.actions");
  const parsed = dealContextSchema(t).safeParse({
    dealAmount: String(formData.get("dealAmount") ?? ""),
    dealCurrency: String(formData.get("dealCurrency") ?? "EUR"),
    decisionDeadline: String(formData.get("decisionDeadline") ?? ""),
    decisionMakerName: String(formData.get("decisionMakerName") ?? ""),
    decisionMakerRole: String(formData.get("decisionMakerRole") ?? ""),
    sellerNotes: String(formData.get("sellerNotes") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("invalidContext") };

  const { dealAmount, ...rest } = parsed.data;
  // Consent to be named in prospecting messages: dated when first given, removed at once
  const consent = formData.get("referenceConsent") === "on";
  const current = await prisma.link.findUnique({ where: { id: link.id }, select: { referenceConsentAt: true } });
  await prisma.link.update({
    where: { id: link.id },
    data: {
      ...rest,
      dealAmountCents: dealAmount,
      referenceConsentAt: consent ? (current?.referenceConsentAt ?? new Date()) : null,
    },
  });
  // Prospecting messages already written may name this customer: rewrite them without it
  if (current?.referenceConsentAt && !consent) {
    await prisma.prospectSuggestion.updateMany({
      where: { organizationId: link.organizationId, hookBody: { not: null } },
      data: { hookSubject: null, hookBody: null },
    });
  }
  inBackground("brain", () => analyzeDeal(link.id, "SELLER_UPDATE"));
  revalidateLink(link);
  return { ok: true };
}

const sellerActivitySchema = (t: ActionsT) =>
  z.object({
  type: z.enum(["CALL", "EMAIL_REPLY_RECEIVED", "MEETING", "NOTE"]),
  note: optionalText(1000),
  occurredAt: z
    .string()
    .trim()
    .transform((v) => (v === "" ? new Date() : new Date(v)))
    .refine((v) => !Number.isNaN(v.getTime()), { message: t("invalidDate") }),
});

// Calls, replies and meetings happen outside Clozer: without them the advice would be blind
export async function logSellerActivity(
  linkId: string,
  _prev: LinkFormState,
  formData: FormData,
): Promise<LinkFormState> {
  const link = await requireOwnedLink(linkId);
  const { user } = await requireWorkspace();
  const t = await getTranslations("deal.actions");
  const parsed = sellerActivitySchema(t).safeParse({
    type: String(formData.get("type") ?? ""),
    note: String(formData.get("note") ?? ""),
    occurredAt: String(formData.get("occurredAt") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("invalidExchange") };
  if (parsed.data.occurredAt.getTime() > Date.now() + 60_000) return { error: t("futureDate") };

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
    const t = await getTranslations("deal.actions");
    return { error: t("pickFutureDate") };
  }
  await prisma.link.update({ where: { id: link.id }, data: { snoozedUntil: date } });
  if (date) await cancelOpenFollowups(link.id, "paused");
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
  const t = await getTranslations("deal.actions");
  if (recent) return { error: t("analysisTooFresh") };

  const outcome = await analyzeDeal(link.id, "MANUAL", { force: true });
  revalidateLink(link);
  const errors: Partial<Record<typeof outcome, string>> = {
    no_ai: t("noAi"),
    budget: t("budget"),
    failed: t("analysisFailed"),
    skipped: t("dealClosed"),
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
  const t = await getTranslations("deal.actions");
  if (!insight) return { error: t("analyzeFirst") };

  const result = await actOnInsight(insight.id, { force: true });
  revalidateLink(link);
  return result.ok ? { ok: true } : { error: result.reasons.join(" ") || t("cannotPrepare") };
}
