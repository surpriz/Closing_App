"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { ExtensionProbe } from "@/lib/onboarding";

import { MailToolTip } from "./mail-tool-tip";
import { startExtensionConnect, useExtensionState } from "./use-extension-state";

/** The Chrome tip, gone once this browser's extension is in, and one click away when it only needs connecting. */
export function ChromeMailToolTip({
  probe,
  mailbox,
  returnTo,
  inline = false,
}: {
  probe: ExtensionProbe;
  mailbox: string;
  returnTo?: string;
  inline?: boolean;
}) {
  const t = useTranslations("onboarding.chromeTip");
  const { state, extensionId } = useExtensionState(probe);
  if (state === "ok") return null;
  const connect = (state === "signed_out" || state === "other_account") && extensionId;
  return (
    <MailToolTip
      tool="chrome"
      mailbox={mailbox}
      returnTo={returnTo}
      inline={inline}
      action={
        connect ? (
          <Button size="sm" variant="outline" onClick={() => startExtensionConnect(connect)}>
            {t("connect")}
          </Button>
        ) : undefined
      }
    />
  );
}
