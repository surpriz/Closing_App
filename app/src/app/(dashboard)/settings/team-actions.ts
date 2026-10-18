"use server";

import { revalidatePath } from "next/cache";
import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { getAppOrigin } from "@/lib/app-origin";
import { auth } from "@/lib/auth";
import { planFor, upgradePrompt, type UpgradeReason } from "@/lib/billing/workspace-plan";
import { prisma } from "@/lib/db";
import { devMagicLinksEnabled } from "@/lib/dev-magic-links";
import { requireManager } from "@/lib/session";

/**
 * Inviting, promoting and removing teammates. Better Auth enforces who may do
 * what (only an owner hands out "owner", the last owner stays); the workspace
 * is always passed explicitly since sessions created before teams have no
 * active organization.
 */

export type TeamActionState = { ok?: boolean; error?: string; devUrl?: string; upgrade?: UpgradeReason } | null;

type TeamT = Awaited<ReturnType<typeof getTranslations<"team.actions">>>;

const inviteSchema = (t: TeamT) =>
  z.object({
    email: z.email(t("invalidEmail")).transform((email) => email.toLowerCase()),
    role: z.enum(["member", "admin"]),
  });

/** Better Auth's error codes in the seller's language (lib/team-errors has the French-only map). */
function teamError(t: TeamT, error: unknown, fallback = t("fallback")) {
  const code = isAPIError(error) ? (error.body as { code?: string } | undefined)?.code : undefined;
  const key = `errors.${code}` as const;
  if (code && t.has(key as never)) return t(key as never);
  console.error("[team]", error);
  return fallback;
}

const roleSchema = z.enum(["member", "admin", "owner"]);

function refresh() {
  revalidatePath("/settings");
  revalidatePath("/team");
}

export async function inviteMember(_prev: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const { organization } = await requireManager();
  const t = await getTranslations("team.actions");
  const parsed = inviteSchema(t).safeParse({
    email: String(formData.get("email") ?? "").trim(),
    role: String(formData.get("role") ?? "member"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("invalidInvitation") };
  // Checked again by the auth hook; here it opens the upgrade dialog instead of a bare error
  if (!planFor(organization).limits.invites) {
    return upgradePrompt("invites");
  }

  try {
    const invitation = await auth.api.createInvitation({
      body: { ...parsed.data, organizationId: organization.id },
      headers: await headers(),
    });
    refresh();
    // No email in local dev: the link is shown to copy instead
    return devMagicLinksEnabled()
      ? { ok: true, devUrl: `${await getAppOrigin()}/invitation/${invitation.id}` }
      : { ok: true };
  } catch (error) {
    return { error: teamError(t, error, t("inviteFailed")) };
  }
}

export async function cancelInvitation(invitationId: string): Promise<TeamActionState> {
  await requireManager();
  const t = await getTranslations("team.actions");
  try {
    await auth.api.cancelInvitation({ body: { invitationId }, headers: await headers() });
  } catch (error) {
    return { error: teamError(t, error) };
  }
  refresh();
  return { ok: true };
}

export async function updateMemberRole(memberId: string, role: string): Promise<TeamActionState> {
  const { organization } = await requireManager();
  const t = await getTranslations("team.actions");
  const parsed = roleSchema.safeParse(role);
  if (!parsed.success) return { error: t("unknownRole") };

  try {
    await auth.api.updateMemberRole({
      body: { memberId, role: parsed.data, organizationId: organization.id },
      headers: await headers(),
    });
  } catch (error) {
    return { error: teamError(t, error) };
  }
  refresh();
  return { ok: true };
}

export async function removeMember(memberId: string): Promise<TeamActionState> {
  const { organization } = await requireManager();
  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId: organization.id },
    select: { userId: true },
  });
  const t = await getTranslations("team.actions");
  if (!member) return { error: t("memberGone") };

  try {
    await auth.api.removeMember({
      body: { memberIdOrEmail: memberId, organizationId: organization.id },
      headers: await headers(),
    });
  } catch (error) {
    return { error: teamError(t, error) };
  }
  // Their deals go back to the owner, like links nobody created
  await prisma.link.updateMany({
    where: { organizationId: organization.id, createdById: member.userId },
    data: { createdById: null },
  });
  refresh();
  return { ok: true };
}
