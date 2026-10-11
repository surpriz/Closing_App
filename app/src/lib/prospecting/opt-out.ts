import { prisma } from "@/lib/db";

import { optOutKeys } from "./opt-out-hash";

type Identity = Parameters<typeof optOutKeys>[0];

/** Global: nobody will be suggested this person again, in any workspace. */
export async function addOptOut(identity: Identity, reason: "seller" | "unsubscribe") {
  const keys = optOutKeys(identity);
  if (keys.length === 0) return;
  await prisma.prospectingOptOut.createMany({
    data: keys.map((key) => ({ ...key, reason })),
    skipDuplicates: true,
  });
}

/** Which of these identities opted out: returns their positions in the input. */
export async function optedOut(identities: Identity[]) {
  const keyed = identities.map((identity) => optOutKeys(identity));
  const hashes = [...new Set(keyed.flat().map((key) => key.valueHash))];
  if (hashes.length === 0) return new Set<number>();

  const rows = await prisma.prospectingOptOut.findMany({
    where: { valueHash: { in: hashes } },
    select: { kind: true, valueHash: true },
  });
  const blocked = new Set(rows.map((row) => `${row.kind}:${row.valueHash}`));
  return new Set(
    keyed.flatMap((keys, index) => (keys.some((key) => blocked.has(`${key.kind}:${key.valueHash}`)) ? [index] : [])),
  );
}
