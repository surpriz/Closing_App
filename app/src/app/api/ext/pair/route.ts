import { prisma } from "@/lib/db";
import {
  formatUserCode,
  generatePollSecret,
  generateUserCode,
  hashPollSecret,
  PAIRING_TTL_MS,
} from "@/lib/extension-pairing";

// The Outlook add-in starts a pairing. No auth: the add-in has no token yet.
// It keeps `poll` to itself and shows `code` to the seller, who types it in the app.
export async function POST() {
  await prisma.extensionPairing.deleteMany({ where: { expiresAt: { lt: new Date() } } });

  const poll = generatePollSecret();
  const code = generateUserCode();
  const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
  await prisma.extensionPairing.create({ data: { pollHash: hashPollSecret(poll), userCode: code, expiresAt } });

  // The add-in opens /extension/outlook itself. The code never travels in a URL: the
  // seller types what their own Outlook shows, so a link sent by someone else can't
  // pair that person's Outlook with this account.
  return Response.json(
    { poll, code: formatUserCode(code), expiresAt: expiresAt.toISOString() },
    { status: 201 },
  );
}
