"use client";

import { Check, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { markLinkCopied } from "@/app/(dashboard)/links/actions";
import { Button } from "@/components/ui/button";
import { copyLink } from "@/lib/clipboard";

/** Copies a link. Icon only by default; with `label` it becomes a full button. */
export function CopyButton({
  value,
  title,
  label,
  variant = "ghost",
  size,
  draftLinkId,
}: {
  value: string;
  /** A proposal link: pasted in an email it reads as this title, clickable, instead of its address. */
  title?: string;
  label?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
  /** A link not sent yet: copying it counts, as it does from the share screen. */
  draftLinkId?: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const t = useTranslations("common.copyButton");

  return (
    <Button
      type="button"
      variant={variant}
      size={label ? (size ?? "default") : "icon-xs"}
      aria-label={label ? undefined : t("copyLink")}
      onClick={async () => {
        await (title ? copyLink({ url: value, title }) : navigator.clipboard.writeText(value));
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        if (!draftLinkId) return;
        // The copy worked: failing to note it only delays the "copied" state, nothing to tell
        try {
          await markLinkCopied(draftLinkId);
          router.refresh();
        } catch (error) {
          console.error("[copy] could not mark the link copied", error);
        }
      }}
    >
      {copied ? <Check /> : <Copy />}
      {label && (copied ? t("copied") : label)}
    </Button>
  );
}
