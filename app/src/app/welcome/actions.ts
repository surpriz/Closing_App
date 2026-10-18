"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { getAppOrigin } from "@/lib/app-origin";
import { createDocumentLink } from "@/lib/closing/documents/create-link";
import { upsertSellerPrefs } from "@/lib/closing/notify/preferences";
import { prisma } from "@/lib/db";
import { isTestRead, OFFER_DESCRIPTION_MAX, parseMailClient, testLinkName } from "@/lib/onboarding";
import { isManagerRole } from "@/lib/roles";
import { requireWorkspace } from "@/lib/session";

export async function saveMailClient(value: unknown) {
  const mailClient = parseMailClient(value);
  if (!mailClient) return;
  const { user, organization } = await requireWorkspace();
  await upsertSellerPrefs(user.id, organization.id, { mailClient });
}

// Reaching the last screen counts as done: the seller may leave from there
// by uploading a document, which navigates away on its own
export async function completeOnboarding() {
  const { user, organization } = await requireWorkspace();
  await upsertSellerPrefs(user.id, organization.id, { onboardingCompletedAt: new Date() });
  revalidatePath("/dashboard");
}

// Only fills an empty offer: the full form lives in the settings
export async function saveOfferDescription(input: unknown): Promise<{ ok: boolean }> {
  const { organization, role } = await requireWorkspace();
  const offerDescription = typeof input === "string" ? input.trim().slice(0, OFFER_DESCRIPTION_MAX) : "";
  if (!isManagerRole(role) || !offerDescription) return { ok: false };
  const { count } = await prisma.workspaceSettings.updateMany({
    where: { organizationId: organization.id, OR: [{ offerDescription: null }, { offerDescription: "" }] },
    data: { offerDescription, offerInferredFrom: null },
  });
  revalidatePath("/settings");
  return { ok: count > 0 };
}

// "Ne plus afficher" on the share screen tip
export async function hideMailToolTip() {
  const { user, organization } = await requireWorkspace();
  await upsertSellerPrefs(user.id, organization.id, { mailToolTipHiddenAt: new Date() });
}

// Closing the banner about the Chrome extension: back in a week
export async function snoozeExtensionNudge() {
  const { user, organization } = await requireWorkspace();
  await upsertSellerPrefs(user.id, organization.id, { extensionNudgeHiddenAt: new Date() });
}

/** First visit of the tour, for the getting-started funnel. */
export async function startOnboarding() {
  const { user, organization } = await requireWorkspace();
  const where = { userId_organizationId: { userId: user.id, organizationId: organization.id } };
  const prefs = await prisma.notificationPreference.findUnique({ where, select: { onboardingStartedAt: true } });
  if (prefs?.onboardingStartedAt) return;
  await upsertSellerPrefs(user.id, organization.id, { onboardingStartedAt: new Date() });
}

/**
 * The link the seller opens to see what the prospect sees. A draft (never a
 * deal, archived with the other drafts), no email gate, no follow-up.
 */
export async function createOnboardingTestLink(
  documentId: string,
): Promise<{ linkId: string; url: string } | { error: string }> {
  const { user, organization } = await requireWorkspace();
  const document = await prisma.document.findFirst({
    where: { id: String(documentId), organizationId: organization.id, archivedAt: null },
    select: { id: true, name: true },
  });
  const t = await getTranslations("onboarding");
  if (!document) return { error: t("documentNotFound") };

  const link = await createDocumentLink({
    userId: user.id,
    organizationId: organization.id,
    documentId: document.id,
    name: testLinkName(document.name),
    requireEmail: false,
    followupsEnabled: false,
    draft: true,
    onboardingTest: true,
  });
  if (!link) return { error: t("documentNotFound") };
  return { linkId: link.id, url: `${await getAppOrigin()}/v/${link.slug}` };
}

export type TestLinkStatus = {
  /** The viewer only tracks a document once it is processed. */
  ready: boolean;
  /** Processing gave up on it: the tour offers another document. */
  failed: boolean;
  read: { pages: number; seconds: number } | null;
};

/** Polled by the tour while the seller opens their test link. */
export async function onboardingTestStatus(linkId: string): Promise<TestLinkStatus | null> {
  const { user, organization } = await requireWorkspace();
  const link = await prisma.link.findFirst({
    where: { id: String(linkId), organizationId: organization.id, isOnboardingTest: true },
    select: {
      document: { select: { status: true } },
      views: {
        orderBy: { startedAt: "desc" },
        take: 5,
        select: { isBot: true, fromSeller: true, maxPageReached: true, totalDurationMs: true },
      },
    },
  });
  if (!link) return null;

  const view = link.views.find(isTestRead);
  if (view) {
    await prisma.notificationPreference.updateMany({
      where: { userId: user.id, organizationId: organization.id, onboardingTestReadAt: null },
      data: { onboardingTestReadAt: new Date() },
    });
  }
  return {
    ready: link.document.status === "READY",
    failed: link.document.status === "FAILED",
    read: view ? { pages: view.maxPageReached, seconds: Math.round(view.totalDurationMs / 1000) } : null,
  };
}
