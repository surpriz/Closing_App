"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/** Copies a link. Icon only by default; with `label` it becomes a full button. */
export function CopyButton({
  value,
  label,
  variant = "ghost",
  size,
}: {
  value: string;
  label?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
}) {
  const [copied, setCopied] = useState(false);
  const t = useTranslations("common.copyButton");

  return (
    <Button
      type="button"
      variant={variant}
      size={label ? (size ?? "default") : "icon-xs"}
      aria-label={label ? undefined : t("copyLink")}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check /> : <Copy />}
      {label && (copied ? t("copied") : label)}
    </Button>
  );
}
