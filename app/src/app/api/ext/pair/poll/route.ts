import { z } from "zod";

import { getTranslator } from "@/i18n/messages";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { extError, requestUiLocale } from "@/lib/extension-auth";
import { hashPollSecret } from "@/lib/extension-pairing";

const schema = z.object({ poll: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });

// The add-in asks every few seconds whether the seller typed the code. The token
// is handed over once, then the row is gone.
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return extError(400, "invalid");

  const pairing = await prisma.extensionPairing.findUnique({ where: { pollHash: hashPollSecret(parsed.data.poll) } });
  // No seller yet: the add-in's language
  const expired = () => extError(410, "expired", getTranslator(requestUiLocale(request))("server.ext.codeExpired"));
  if (!pairing || pairing.expiresAt < new Date()) return expired();
  if (!pairing.tokenCiphertext) return Response.json({ status: "pending" });

  // deleteMany: two polls racing, only one gets the token
  const { count } = await prisma.extensionPairing.deleteMany({ where: { id: pairing.id } });
  if (count === 0) return expired();
  return Response.json({ status: "done", token: decryptSecret(pairing.tokenCiphertext) });
}
