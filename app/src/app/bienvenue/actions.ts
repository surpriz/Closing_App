"use server";

import { revalidatePath } from "next/cache";

import { upsertSellerPrefs } from "@/lib/closing/notify/preferences";
import { prisma } from "@/lib/db";
import { OFFER_DESCRIPTION_MAX, parseMailClient } from "@/lib/onboarding";
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
