/**
 * Talks to the Clozer extension from an app page (chrome.runtime.sendMessage
 * with its id). Browser only; safe to import from client components.
 */

type ChromeRuntime = {
  sendMessage: (id: string, message: unknown, callback: (response: unknown) => void) => void;
  lastError?: { message?: string };
};

function chromeRuntime() {
  return (globalThis as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;
}

/**
 * The extension's answer, or null: not installed, too old to hear this page, or
 * silent past the timeout. chrome.runtime only shows up on pages an installed
 * extension listens to, as the page loads.
 */
export function askExtension(id: string, message: unknown, timeoutMs?: number) {
  return new Promise<unknown>((resolve) => {
    const runtime = chromeRuntime();
    if (!runtime?.sendMessage) return resolve(null);
    const timer = timeoutMs ? setTimeout(() => resolve(null), timeoutMs) : undefined;
    try {
      runtime.sendMessage(id, message, (response) => {
        clearTimeout(timer);
        resolve(runtime.lastError ? null : (response ?? null));
      });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

// Resolves true when the extension said ok
export async function sendToExtension(id: string, message: unknown) {
  const response = await askExtension(id, message);
  return (response as { ok?: boolean } | null)?.ok === true;
}
