"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { upsertSellerPrefs } from "@/lib/closing/notify/preferences";
import { prisma } from "@/lib/db";
import { generateExtensionToken, hashExtensionToken, tokenHint } from "@/lib/extension-tokens";
import { requireWorkspace } from "@/lib/session";

function browserLabel(userAgent: string) {
  const browser = /Edg\//.test(userAgent) ? "Edge" : /Chrome\//.test(userAgent) ? "Chrome" : "Navigateur";
  const os = /Mac OS X/.test(userAgent)
    ? "macOS"
    : /Windows/.test(userAgent)
      ? "Windows"
      : /CrOS/.test(userAgent)
        ? "ChromeOS"
        : /Linux/.test(userAgent)
          ? "Linux"
          : null;
  return os ? `${browser} · ${os}` : browser;
}

// The plain token is returned once, handed to the extension, and never stored
export async function connectExtension() {
  const { user, organization } = await requireWorkspace();
  const token = generateExtensionToken();

  const { id } = await prisma.extensionToken.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      tokenHash: hashExtensionToken(token),
      hint: tokenHint(token),
      label: browserLabel((await headers()).get("user-agent") ?? ""),
    },
    select: { id: true },
  });

  revalidatePath("/settings");
  return { id, token };
}

export async function revokeExtensionToken(id: string) {
  const { user, organization } = await requireWorkspace();
  await prisma.extensionToken.updateMany({
    where: { id, userId: user.id, organizationId: organization.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  revalidatePath("/settings");
}

// The seller did not see the test notification (blocked by the OS): call
// moments are emailed too, until they can be shown again
export async function enableCallMomentEmails() {
  const { user, organization } = await requireWorkspace();
  await upsertSellerPrefs(user.id, organization.id, { emailCallMoments: true });
  revalidatePath("/settings");
}
