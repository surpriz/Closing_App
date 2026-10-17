import { ClozerError, type Account, type UpdateStatus } from "./messages";

/** What the app's pages learn about this browser's extension. */
export type ExternalStatus = { ok: true; version: string; signedIn: boolean; email: string | null };

type Deps = {
  version: string;
  account: () => Promise<Account | null>;
  startConnect: () => Promise<unknown>;
  update: () => Promise<UpdateStatus>;
};

// The page waits for the answer: past this, a token is enough to say signed in
const STATUS_WAIT_MS = 800;

async function status({ version, account }: Deps): Promise<ExternalStatus> {
  try {
    // account() is null at once without a token, so a slow answer means there is one
    const slow = new Promise<"slow">((resolve) => setTimeout(() => resolve("slow"), STATUS_WAIT_MS));
    const me = await Promise.race([account(), slow]);
    if (me === "slow") return { ok: true, version, signedIn: true, email: null };
    return { ok: true, version, signedIn: me !== null, email: me?.user.email ?? null };
  } catch (error) {
    // A 401 already dropped the token. Offline, the token still counts: don't nag for that
    const signedIn = !(error instanceof ClozerError && error.code === "unauthorized");
    return { ok: true, version, signedIn, email: null };
  }
}

/**
 * Messages any app page may send, so the app can nudge the seller to install,
 * connect or update. undefined: not one of these.
 */
export function answerExternal(type: unknown, deps: Deps): Promise<unknown> | undefined {
  switch (type) {
    case "clozer:status":
      return status(deps);
    case "clozer:start-connect":
      return deps.startConnect().then(() => ({ ok: true }));
    case "clozer:update":
      return deps.update().then((data) => ({ ok: true, data }));
  }
}
