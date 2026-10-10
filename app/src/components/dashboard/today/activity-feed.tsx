import { BellRing, Check, Eye, Hourglass, MessageSquare, Send } from "lucide-react";
import Link from "next/link";

import type { FeedItem, FeedKind } from "@/lib/closing/dashboard/feed";
import { formatDate, formatRelative } from "@/lib/format";

const ICONS: Record<FeedKind, React.ReactNode> = {
  read: <Eye />,
  validated: <Check />,
  change: <MessageSquare />,
  extension: <Hourglass />,
  alert: <BellRing className="text-heat-hot" />,
  followup: <Send />,
};

/** Answers from prospects stand out; readings and follow-ups stay quiet. */
const STRONG: FeedKind[] = ["validated", "change", "extension"];

export function ActivityFeed({ items, now }: { items: FeedItem[]; now: Date }) {
  return (
    <ol className="space-y-4">
      {items.map((item) => (
        <li key={item.id} className="flex gap-3 text-sm">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border [&_svg]:size-3.5">
            {ICONS[item.kind]}
          </span>
          <div className="min-w-0 space-y-1">
            <p className="text-pretty [overflow-wrap:anywhere]">
              <Link href={`/links/${item.linkId}`} className="font-medium hover:underline">
                {item.who}
              </Link>{" "}
              <span className={STRONG.includes(item.kind) ? "" : "text-muted-foreground"}>{item.what}</span>
            </p>
            {item.quote && (
              <p className="border-l-2 border-border pl-2.5 text-pretty text-muted-foreground">{item.quote}</p>
            )}
            <time className="block text-xs text-muted-foreground" title={formatDate(item.at)}>
              {formatRelative(item.at, now)}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}
