// A fresh PDF gets its readable title from the AI a few seconds after upload.
// The link is created once the title is there, so the email shows the title
// rather than the file name. Bounded: past the timeout, the file name it is.
// Pure (no WXT): the Outlook add-in imports it as @ext/title-wait.

export type Titled = { titled?: boolean };

export type WaitForTitleOptions<T> = {
  timeoutMs?: number;
  pollMs?: number;
  /** Called once, the first time the title turns out not to be there yet. */
  onWait?: () => void;
  /** The document as already known: saves the first fetch. */
  initial?: T;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A document without the flag comes from a server that never sets it: nothing to wait for
function ready(document: Titled | null): boolean {
  return document !== null && document.titled !== false;
}

export async function waitForTitle<T extends Titled>(fetch: () => Promise<T>, options: WaitForTitleOptions<T> = {}): Promise<T | null> {
  const { timeoutMs = 15_000, pollMs = 1_000, onWait, initial } = options;
  let document: T | null = initial ?? (await fetch().catch(() => null));
  if (ready(document)) return document;

  onWait?.();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(Math.min(pollMs, deadline - Date.now()));
    document = (await fetch().catch(() => null)) ?? document;
    if (ready(document)) return document;
  }
  return document;
}
