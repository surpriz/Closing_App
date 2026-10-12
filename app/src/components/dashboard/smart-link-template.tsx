"use client";

import Link from "next/link";
import { useState } from "react";

import { SMART_LINK_TOOLS, smartLinkUrl, type SmartLinkTool } from "@/lib/closing/shared/smart-params";
import { cn } from "@/lib/utils";

import { CopyButton } from "./copy-button";

const TOOLS = Object.keys(SMART_LINK_TOOLS) as SmartLinkTool[];

/** The shared link with the cold email tool's variables, to paste in a sequence. */
export function SmartLinkTemplate({ url }: { url: string }) {
  const [tool, setTool] = useState<SmartLinkTool>("lemlist");
  const value = smartLinkUrl(url, tool);

  return (
    <div className="space-y-3 px-4 py-3 text-sm">
      <p className="text-muted-foreground">
        Collez ce lien dans votre séquence : chaque prospect qui clique arrive sans formulaire,
        avec son propre suivi.
      </p>
      <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Outil de cold email">
        {TOOLS.map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={tool === key}
            onClick={() => setTool(key)}
            className={cn(
              "rounded-md px-2.5 py-1 text-sm transition-colors",
              tool === key ? "bg-card shadow-xs" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {SMART_LINK_TOOLS[key].label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 ring-1 ring-border">
        <code className="min-w-0 flex-1 truncate text-xs">{value}</code>
        <CopyButton value={value} />
      </div>
      <p className="text-xs text-muted-foreground">
        {SMART_LINK_TOOLS[tool].documented
          ? `Les variables sont celles de ${SMART_LINK_TOOLS[tool].label}.`
          : "Vérifiez le nom des variables dans l'éditeur de votre outil."}{" "}
        Pour mettre la séquence en pause dès qu&apos;un prospect lit, branchez le{" "}
        <Link href="/settings#alertes" className="underline underline-offset-2 hover:text-foreground">
          webhook
        </Link>
        .
      </p>
    </div>
  );
}
