import { CornerDownRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import type { UiLocale } from "@/i18n/locale";
import type { ForwardNode, ForwardTree } from "@/lib/closing/forward/tree";
import { formatDuration, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

import { LiveDot } from "./heat";

/** Past this depth the indent stops growing: a long chain stays readable on a phone. */
const MAX_INDENT = 4;

/**
 * "Circuit du document": who passed the proposal to whom, with what each
 * person read and did. Contacts first, then the readers who arrived without
 * "Transférer" (a forward from their mailbox).
 */
export function ForwardTreeView({ tree, now }: { tree: ForwardTree; now: Date }) {
  const t = useTranslations("deal.forwardTree");
  return (
    <div className="space-y-5 pt-3">
      {tree.roots.length > 0 && <Branch nodes={tree.roots} depth={0} now={now} />}
      {tree.offClozer.length > 0 && (
        <div>
          <p className="mb-1.5 text-small text-muted-foreground">
            {t("offClozer")} <span className="text-muted-foreground/80">· {t("offClozerHint")}</span>
          </p>
          <Branch nodes={tree.offClozer} depth={0} now={now} />
        </div>
      )}
      {tree.anonymous > 0 && <p className="text-small text-muted-foreground">{t("anonymous", { count: tree.anonymous })}</p>}
    </div>
  );
}

function Branch({ nodes, depth, now }: { nodes: ForwardNode[]; depth: number; now: Date }) {
  return (
    <ol className={cn("space-y-3", depth > 0 && depth <= MAX_INDENT && "mt-3 ml-1.5 border-l border-border pl-4")}>
      {nodes.map((node) => (
        <li key={node.prospectId}>
          <NodeLine node={node} nested={depth > 0} now={now} />
          {node.children.length > 0 && <Branch nodes={node.children} depth={depth + 1} now={now} />}
        </li>
      ))}
    </ol>
  );
}

function NodeLine({ node, nested, now }: { node: ForwardNode; nested: boolean; now: Date }) {
  const t = useTranslations("deal.forwardTree");
  const tl = useTranslations("labels");
  const locale = useLocale() as UiLocale;
  const role = node.role ? tl(`prospectRole.${node.role.role}`) : null;

  const reading = node.opened
    ? [
        node.readingNow ? t("readingNow") : t("openedAgo", { when: formatRelative(node.lastReadAt!, locale, now) }),
        t("views", { count: node.views }),
        formatDuration(node.readingMs),
        node.hotPages.length > 0 ? t("pages", { pages: node.hotPages.join(", ") }) : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : node.received?.failed
      ? t("notDelivered")
      : t("notOpened");

  return (
    <div className="space-y-1 text-body">
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {nested && <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
        {node.readingNow && <LiveDot className="shrink-0" />}
        <span className="truncate font-medium">{node.label}</span>
        {node.role && role && node.role.role !== "OTHER" && (
          <Badge
            variant={node.decision ? "default" : "secondary"}
            title={node.role.source === "seller" ? t("taggedByYou") : t("guessedFromEmail")}
          >
            {node.role.source === "detected" ? t("guessed", { role }) : role}
          </Badge>
        )}
        {node.actions.map((action) => (
          <Badge key={action} variant={action === "signed" ? "success" : "outline"}>
            {t(`action.${action}`)}
          </Badge>
        ))}
      </span>
      {node.label !== node.email && <span className="block truncate text-small text-muted-foreground">{node.email}</span>}
      <span className={cn("block text-small", node.received?.failed && !node.opened ? "text-destructive" : "text-muted-foreground")}>
        {reading}
      </span>
      {node.received && (
        <span className="block text-small text-muted-foreground">
          {node.received.message && <span className="text-foreground">{`« ${node.received.message} » `}</span>}
          {node.received.from
            ? t("forwardedBy", { name: node.received.from, when: formatRelative(node.received.at, locale, now) })
            : t("forwardedAgo", { when: formatRelative(node.received.at, locale, now) })}
        </span>
      )}
    </div>
  );
}
