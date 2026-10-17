"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { ExtensionProbe } from "@/lib/onboarding";

import { startExtensionConnect, updateExtension, useExtensionState } from "./use-extension-state";

/** "Sur ce navigateur : …", under the Chrome card. Nothing outside desktop Chromium. */
export function ExtensionStatus({ probe }: { probe: ExtensionProbe }) {
  const t = useTranslations("onboarding.extensionStatus");
  const { state, reply, extensionId } = useExtensionState(probe);
  if (!state) return null;

  let label: string;
  if (state === "ok") label = reply ? t("connectedVersion", { version: reply.version }) : t("connected");
  else if (state === "other_account" && reply?.email) label = t("connectedTo", { email: reply.email });
  else label = t(state);

  return (
    <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
      <p className="text-small text-muted-foreground">{t("line", { label })}</p>
      {extensionId && (state === "signed_out" || state === "other_account") && (
        <Button size="sm" variant="outline" onClick={() => startExtensionConnect(extensionId)}>
          {t("connect")}
        </Button>
      )}
      {extensionId && state === "outdated" && (
        <Button size="sm" variant="outline" onClick={() => updateExtension(extensionId)}>
          {t("update")}
        </Button>
      )}
    </div>
  );
}
