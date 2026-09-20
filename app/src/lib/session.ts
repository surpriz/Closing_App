import { randomUUID } from "node:crypto";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { randomSlug } from "@/lib/ids";

export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

// Returns the signed-in user and their workspace, creating the workspace on
// first sign-in. Null when signed out.
export const getWorkspace = cache(async () => {
  const session = await getSession();
  if (!session) return null;

  const { user } = session;
  const membership = await prisma.member.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: { organization: true },
  });

  if (membership) {
    return { user, organization: membership.organization };
  }

  const now = new Date();
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

  return { user, organization };
});

export async function requireWorkspace() {
  const workspace = await getWorkspace();
  if (!workspace) redirect("/login");
  return workspace;
}
