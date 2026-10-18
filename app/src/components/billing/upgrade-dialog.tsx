"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BILLING_HREF } from "@/lib/billing/plans";

const OPEN_UPGRADE_EVENT = "clozer:upgrade";

/** A server answer that hit a plan limit: `error` is the message to show. */
export type UpgradePrompt = { error: string; upgrade: string };

export function isUpgradePrompt(value: unknown): value is UpgradePrompt {
  return typeof value === "object" && value !== null && "upgrade" in value && "error" in value;
}

/** Opens the dashboard's upgrade dialog from anywhere, with the server's message. */
export function openUpgrade(prompt: UpgradePrompt) {
  window.dispatchEvent(new CustomEvent<UpgradePrompt>(OPEN_UPGRADE_EVENT, { detail: prompt }));
}

/** Mounted once in the dashboard layout. */
export function UpgradeDialogHost() {
  const t = useTranslations("billing.upgrade");
  const [prompt, setPrompt] = useState<UpgradePrompt | null>(null);

  useEffect(() => {
    const onOpen = (event: Event) => setPrompt((event as CustomEvent<UpgradePrompt>).detail);
    window.addEventListener(OPEN_UPGRADE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_UPGRADE_EVENT, onOpen);
  }, []);

  return (
    <Dialog open={prompt !== null} onOpenChange={(open) => !open && setPrompt(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{prompt?.error}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{t("later")}</DialogClose>
          <Button render={<Link href={BILLING_HREF} onClick={() => setPrompt(null)} />} nativeButton={false}>
            {t("cta")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
