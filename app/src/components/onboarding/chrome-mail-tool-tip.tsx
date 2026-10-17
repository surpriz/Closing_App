"use client";

import { Button } from "@/components/ui/button";
import type { ExtensionProbe } from "@/lib/onboarding";

import { MailToolTip } from "./mail-tool-tip";
import { startExtensionConnect, useExtensionState } from "./use-extension-state";

/** The Chrome tip, gone once this browser's extension is in, and one click away when it only needs connecting. */
export function ChromeMailToolTip({ probe, mailbox }: { probe: ExtensionProbe; mailbox: string }) {
  const { state, extensionId } = useExtensionState(probe);
  if (state === "ok") return null;
  const connect = (state === "signed_out" || state === "other_account") && extensionId;
  return (
    <MailToolTip
      tool="chrome"
      mailbox={mailbox}
      action={
        connect ? (
          <Button size="sm" variant="outline" onClick={() => startExtensionConnect(connect)}>
            Connecter l&apos;extension
          </Button>
        ) : undefined
      }
    />
  );
}
