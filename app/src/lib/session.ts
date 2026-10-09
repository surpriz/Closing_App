import { randomUUID } from "node:crypto";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth";
import type { SellerScope } from "@/lib/closing/dashboard/queries";
import { prisma } from "@/lib/db";
import { randomSlug } from "@/lib/ids";
import { isManagerRole, isOwnerRole } from "@/lib/roles";

export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

type Workspace = {
  user: NonNullable<Awaited<ReturnType<typeof getSession>>>["user"];
  organization: Awaited<ReturnType<typeof prisma.organization.create>>;
  role: string;
  /** The deals this user calls "mine". */
  scope: SellerScope;
};

type Resolved =
  | { kind: "signed_out" }
  | { kind: "invited"; invitationId: string }
  | { kind: "ok"; workspace: Workspace };

// The signed-in user's workspace: the active organization when Better Auth
// set one (accepting an invitation does), else the latest joined. A user with
// no workspace gets one created on first sign-in, unless an invitation is
// waiting for them: joining the team must not leave an empty workspace behind.
const resolveWorkspace = cache(async (): Promise<Resolved> => {
  const session = await getSession();
  if (!session) return { kind: "signed_out" };

  const { user } = session;
  const activeOrganizationId = session.session.activeOrganizationId;
  const membership =
    (activeOrganizationId &&
      (await prisma.member.findFirst({
        where: { userId: user.id, organizationId: activeOrganizationId },
        include: { organization: true },
      }))) ||
    (await prisma.member.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { organization: true },
    }));

  if (membership) {
    return {
      kind: "ok",
      workspace: {
        user,
        organization: membership.organization,
        role: membership.role,
        scope: { userId: user.id, isOwner: isOwnerRole(membership.role) },
      },
    };
  }

  const now = new Date();
  const invitation = await prisma.invitation.findFirst({
    where: { email: { equals: user.email, mode: "insensitive" }, status: "pending", expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (invitation) return { kind: "invited", invitationId: invitation.id };

  const organization = await prisma.organization.create({
    data: {
      id: randomUUID(),
      name: user.name?.trim() || user.email.split("@")[0],
      slug: `ws-${randomSlug(10).toLowerCase()}`,
      createdAt: now,
      members: {
        create: {
          id: randomUUID(),
          userId: user.id,
          role: "owner",
          createdAt: now,
        },
      },
      settings: { create: {} },
    },
  });

  return {
    kind: "ok",
    workspace: { user, organization, role: "owner", scope: { userId: user.id, isOwner: true } },
  };
});

// Returns the signed-in user, their workspace and role, creating the
// workspace on first sign-in. Null when signed out or still to accept an
// invitation.
export const getWorkspace = cache(async () => {
  const resolved = await resolveWorkspace();
  return resolved.kind === "ok" ? resolved.workspace : null;
});

// `next` brings the seller back to this page after signing in
export async function requireWorkspace(next?: string) {
  const resolved = await resolveWorkspace();
  if (resolved.kind === "invited") redirect(`/invitation/${resolved.invitationId}`);
  if (resolved.kind === "signed_out") redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return resolved.workspace;
}

/** Owners and admins only: the others land back on their own day. */
export async function requireManager(next?: string) {
  const workspace = await requireWorkspace(next);
  if (!isManagerRole(workspace.role)) redirect("/dashboard");
  return workspace;
}

/** The seller (or a teammate) is signed in on this browser: their own link views are not a prospect reading. */
export async function isWorkspaceMember(organizationId: string) {
  const session = await getSession().catch(() => null);
  if (!session) return false;
  const member = await prisma.member.findFirst({
    where: { userId: session.user.id, organizationId },
    select: { id: true },
  });
  return member !== null;
}
