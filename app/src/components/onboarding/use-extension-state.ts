"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { askExtension } from "@/lib/extension-bridge";
import {
  canInstallChromeExtension,
  extensionState,
  type ExtensionProbe,
  type ExtensionReply,
  type ExtensionState,
} from "@/lib/onboarding";

const noSubscribe = () => () => {};

function parseReply(response: unknown): ExtensionReply | null {
  const reply = response as Partial<ExtensionReply> & { ok?: boolean };
  if (reply?.ok !== true || typeof reply.version !== "string") return null;
  return { version: reply.version, signedIn: reply.signedIn === true, email: reply.email ?? null };
}

type Found = { id: string | null; reply: ExtensionReply | null };

async function probeExtension(ids: string[]): Promise<Found> {
  const replies = await Promise.all(
    ids.map(async (id) => ({ id, reply: parseReply(await askExtension(id, { type: "clozer:status" }, 3000)) })),
  );
  // Dev and store builds side by side: the signed-in one speaks for the browser
  const answered = replies.filter((item) => item.reply).sort((a, b) => Number(b.reply!.signedIn) - Number(a.reply!.signedIn));
  return answered[0] ?? { id: null, reply: null };
}

/**
 * This browser's extension: null while unknown, and for good outside desktop
 * Chromium. Asks again when the seller comes back to the tab (from the connect
 * page, or the popup after signing out).
 */
export function useExtensionState(probe: ExtensionProbe) {
  // The user agent only exists in the browser: say nothing about it on the server
  const canInstall = useSyncExternalStore(
    noSubscribe,
    () => canInstallChromeExtension(navigator.userAgent),
    () => false,
  );
  const [found, setFound] = useState<Found | null>(null);
  const { ids } = probe;

  useEffect(() => {
    if (!canInstall) return;
    let live = true;
    const ask = () => probeExtension(ids).then((result) => live && setFound(result));
    void ask();
    const onVisible = () => {
      if (document.visibilityState === "visible") void ask();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [canInstall, ids]);

  const state: ExtensionState | null =
    canInstall && found ? extensionState({ ...probe, reply: found.reply }) : null;
  return { state, reply: found?.reply ?? null, extensionId: found?.id ?? null };
}

/** Opens the connect page from the extension, which holds the nonce. */
export function startExtensionConnect(id: string) {
  return askExtension(id, { type: "clozer:start-connect" });
}

/** Asks Chrome for the new version now. True when it is on its way. */
export async function updateExtension(id: string) {
  const response = (await askExtension(id, { type: "clozer:update" })) as { data?: string } | null;
  return response?.data === "updating";
}
