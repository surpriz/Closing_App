"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { getPublicAppUrl } from "@/lib/app-origin";
import { inBackground } from "@/lib/closing/background";
import { upsertSellerPrefs } from "@/lib/closing/notify/preferences";
import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { normalizeUserCode, outlookConnectedEmail } from "@/lib/extension-pairing";
import { generateExtensionToken, hashExtensionToken, OUTLOOK_TOKEN_LABEL, tokenHint } from "@/lib/extension-tokens";
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

async function createToken(userId: string, organizationId: string, label: string) {
  const token = generateExtensionToken();
  const { id } = await prisma.extensionToken.create({
    data: { organizationId, userId, tokenHash: hashExtensionToken(token), hint: tokenHint(token), label },
    select: { id: true },
  });
  return { id, token };
}

// The plain token is returned once, handed to the extension, and never stored
export async function connectExtension() {
  const { user, organization } = await requireWorkspace();
  const created = await createToken(user.id, organization.id, browserLabel((await headers()).get("user-agent") ?? ""));
  revalidatePath("/settings");
  return created;
}

// The seller typed the code shown in the Outlook add-in. The token waits, encrypted,
// on the pairing row until the add-in polls for it.
export async function claimOutlookPairing(input: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { user, organization } = await requireWorkspace();
  const code = normalizeUserCode(input);
  const pairing = code
    ? await prisma.extensionPairing.findUnique({ where: { userCode: code }, select: { id: true, expiresAt: true, tokenCiphertext: true } })
    : null;
  if (!pairing || pairing.expiresAt < new Date() || pairing.tokenCiphertext) {
    return { ok: false, message: "Code inconnu ou expiré. Vérifiez le code affiché dans Outlook." };
  }

  const { id, token } = await createToken(user.id, organization.id, OUTLOOK_TOKEN_LABEL);
  const { count } = await prisma.extensionPairing.updateMany({
    where: { id: pairing.id, tokenCiphertext: null },
    data: { tokenCiphertext: encryptSecret(token) },
  });
  if (count === 0) {
    await prisma.extensionToken.update({ where: { id }, data: { revokedAt: new Date() } });
    return { ok: false, message: "Ce code vient d'être utilisé. Recommencez depuis Outlook." };
  }

  if (isEmailConfigured()) {
    const email = outlookConnectedEmail({ at: new Date(), settingsUrl: `${getPublicAppUrl()}/settings#extension` });
    inBackground("outlook-connected-email", () => sendEmail({ to: user.email, ...email }));
  }
  revalidatePath("/settings");
  revalidatePath("/bienvenue");
  return { ok: true };
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
