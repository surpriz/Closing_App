"use client";

import { Puzzle, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { snoozeExtensionNudge } from "@/app/welcome/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ExtensionProbe } from "@/lib/onboarding";

import { startExtensionConnect, updateExtension, useExtensionState } from "./use-extension-state";

/**
 * Top of the dashboard, on desktop Chromium, until this browser's extension is
 * installed, signed in to this account and up to date. Closed: back in a week.
 */
export function ExtensionBanner({ probe, storeUrl }: { probe: ExtensionProbe; storeUrl: string }) {
  const t = useTranslations("onboarding.extensionBanner");
  const { state, reply, extensionId } = useExtensionState(probe);
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  // The page only hears an extension installed before it loaded
  const [installing, setInstalling] = useState(false);

  // The share screen has its own tip about the extension
  if (hidden || !state || state === "ok" || pathname.startsWith("/links/")) return null;

  async function update(id: string) {
    toast(
      (await updateExtension(id)) ? t("updating") : t("updateNotYet"),
    );
  }

  let text: string;
  let action: React.ReactNode;
  if (state === "absent" && installing) {
    text = t("reloadAfterInstall");
    action = (
      <Button size="sm" variant="outline" onClick={() => location.reload()}>
        {t("reload")}
      </Button>
    );
  } else if (state === "absent") {
    text = t("absent");
    action = (
      <a
        href={storeUrl}
        target="_blank"
        rel="noreferrer"
        onClick={() => setInstalling(true)}
        className={buttonVariants({ size: "sm" })}
      >
        {t("install")}
      </a>
    );
  } else if (state === "outdated") {
    text = t("outdated");
    action = extensionId && (
      <Button size="sm" onClick={() => update(extensionId)}>
        {t("update")}
      </Button>
    );
  } else {
    text =
      state === "other_account"
        ? t("otherAccount", { extensionEmail: reply?.email ?? "", userEmail: probe.userEmail })
        : t("signedOut");
    action = extensionId && (
      <Button size="sm" onClick={() => startExtensionConnect(extensionId)}>
        {state === "other_account" ? t("switchAccount") : t("connect")}
      </Button>
    );
  }

  return (
    <aside className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <Puzzle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="min-w-0 flex-1 text-body">{text}</p>
        {action}
        <button
          type="button"
          aria-label={t("hide")}
          title={t("hide")}
          onClick={() => {
            setHidden(true);
            void snoozeExtensionNudge();
          }}
          className="rounded-sm p-1 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </aside>
  );
}
