import { api } from "./api";
import { APP_ORIGIN } from "./config";
import { ClozerError } from "./errors";
import { setToken } from "./settings";

// Outlook never sees the browser session where the seller is signed in to Clozer,
// so it shows a code that the seller confirms in the browser (like pairing a TV).
export type Pairing = { poll: string; code: string; expiresAt: string };

export const CONNECT_URL = `${APP_ORIGIN}/extension/outlook`;

const POLL_MS = 2_000;

export function startPairing() {
  return api<Pairing>("/api/ext/pair", { method: "POST", anonymous: true });
}

// Resolves once the seller confirmed the code; the token is then saved in the mailbox
export async function waitForPairing(
  pairing: Pairing,
  { signal, sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)) }: { signal?: AbortSignal; sleep?: (ms: number) => Promise<unknown> } = {},
) {
  const deadline = new Date(pairing.expiresAt).getTime();
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new ClozerError("aborted", "Connexion annulée.");
    const result = await api<{ status: "pending" | "done"; token?: string }>("/api/ext/pair/poll", {
      body: { poll: pairing.poll },
      anonymous: true,
    }).catch((error: unknown) => {
      // A dropped request is retried; an expired code is not
      if (error instanceof ClozerError && error.code === "network") return { status: "pending" as const };
      throw error;
    });
    if (result.status === "done" && result.token) {
      await setToken(result.token);
      return;
    }
    await sleep(POLL_MS);
  }
  throw new ClozerError("expired", "Le code a expiré. Recommencez la connexion.");
}
