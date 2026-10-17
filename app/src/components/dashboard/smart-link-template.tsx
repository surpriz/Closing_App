"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { SMART_LINK_TOOLS, smartLinkUrl, type SmartLinkTool } from "@/lib/closing/shared/smart-params";
import { cn } from "@/lib/utils";

import { CopyButton } from "./copy-button";

const TOOLS = Object.keys(SMART_LINK_TOOLS) as SmartLinkTool[];

/** The shared link with the cold email tool's variables, to paste in a sequence. */
export function SmartLinkTemplate({ url }: { url: string }) {
  const [tool, setTool] = useState<SmartLinkTool>("lemlist");
  const value = smartLinkUrl(url, tool);
  const t = useTranslations("deal.smartLinkTemplate");

  return (
    <div className="space-y-3 py-4 text-small">
      <p className="text-muted-foreground">
        {t("intro")}
      </p>
      <div className="flex flex-wrap gap-px border border-border bg-border" role="radiogroup" aria-label={t("toolAria")}>
        {TOOLS.map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={tool === key}
            onClick={() => setTool(key)}
            className={cn(
              "bg-card px-2.5 py-1 text-small transition-colors",
              tool === key ? "font-semibold text-foreground shadow-[inset_0_-2px_0_var(--foreground)]" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {SMART_LINK_TOOLS[key].label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 rounded-sm border border-border bg-card py-1.5 pr-1 pl-3">
        <code className="min-w-0 flex-1 truncate font-mono text-micro">{value}</code>
        <CopyButton value={value} />
      </div>
      <p className="text-small text-muted-foreground">
        {SMART_LINK_TOOLS[tool].documented
          ? t("documented", { tool: SMART_LINK_TOOLS[tool].label })
          : t("undocumented")}{" "}
        {t.rich("webhook", {
          link: (chunks) => (
            <Link href="/settings#alertes" className="underline underline-offset-2 hover:text-foreground">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}
