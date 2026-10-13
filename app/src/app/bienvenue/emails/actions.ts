"use server";

import { revalidatePath } from "next/cache";

import { upsertSellerPrefs } from "@/lib/closing/notify/preferences";
import { requireWorkspace } from "@/lib/session";

export async function stopOnboardingEmails() {
  const { user, organization } = await requireWorkspace();
  await upsertSellerPrefs(user.id, organization.id, { onboardingEmailsOff: true });
  revalidatePath("/bienvenue/emails");
}
