import { BellRing, CalendarCheck, CalendarDays, Check, Eye, Hourglass, MessageSquare, Receipt, RotateCcw, Send } from "lucide-react";
import Link from "next/link";
import { useLocale } from "next-intl";

import type { FeedItem, FeedKind } from "@/lib/closing/dashboard/feed";
import { formatDate, formatRelative } from "@/lib/format";

const ICONS: Record<FeedKind, React.ReactNode> = {
  read: <Eye />,
  validated: <Check />,
  change: <MessageSquare />,
  quote: <Receipt />,
  extension: <Hourglass />,
  relink: <RotateCcw />,
  meeting: <CalendarCheck />,
  meeting_click: <CalendarDays />,
  alert: <BellRing className="text-foreground" />,
  followup: <Send />,
};

/** Answers from prospects stand out; readings and follow-ups stay quiet. */
const STRONG: FeedKind[] = ["validated", "change", "quote", "extension", "relink", "meeting"];

export function ActivityFeed({ items, now }: { items: FeedItem[]; now: Date }) {
  const locale = useLocale();
  return (
    <ol className="space-y-4">
      {items.map((item) => (
        <li key={item.id} className="flex gap-3 text-small">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center border border-border bg-card text-muted-foreground [&_svg]:size-3.5">
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
            <p className="text-small text-muted-foreground">
              <time title={formatDate(item.at, locale)}>{formatRelative(item.at, locale, now)}</time>
              {item.context && <span> · {item.context}</span>}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
