import { z } from "zod";

import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { extError } from "@/lib/extension-auth";
import { hashPollSecret } from "@/lib/extension-pairing";

const schema = z.object({ poll: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });

// The add-in asks every few seconds whether the seller typed the code. The token
// is handed over once, then the row is gone.
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return extError(400, "invalid");

  const pairing = await prisma.extensionPairing.findUnique({ where: { pollHash: hashPollSecret(parsed.data.poll) } });
  if (!pairing || pairing.expiresAt < new Date()) {
    return extError(410, "expired", "Le code a expiré. Recommencez la connexion.");
  }
  if (!pairing.tokenCiphertext) return Response.json({ status: "pending" });

  // deleteMany: two polls racing, only one gets the token
  const { count } = await prisma.extensionPairing.deleteMany({ where: { id: pairing.id } });
  if (count === 0) return extError(410, "expired", "Le code a expiré. Recommencez la connexion.");
  return Response.json({ status: "done", token: decryptSecret(pairing.tokenCiphertext) });
}
