import { BellRing, CheckCircle2, Eye, Link2, MessageSquare, Send } from "lucide-react";

import { formatDate, formatRelative } from "@/lib/format";

export type TimelineItem = {
  id: string;
  at: Date;
  kind: "created" | "view" | "validated" | "change" | "followup" | "alert";
  title: string;
  detail?: string | null;
};

const ICONS: Record<TimelineItem["kind"], React.ReactNode> = {
  created: <Link2 className="size-3.5" />,
  view: <Eye className="size-3.5" />,
  validated: <CheckCircle2 className="size-3.5 text-emerald-600" />,
  change: <MessageSquare className="size-3.5 text-amber-600" />,
  followup: <Send className="size-3.5" />,
  alert: <BellRing className="size-3.5 text-red-600" />,
};

export function ActivityTimeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune activité.</p>;
  }

  return (
    <ol className="relative space-y-4 border-l pl-6">
      {items.map((item) => (
        <li key={item.id} className="relative text-sm">
          <span className="absolute -left-[33px] flex size-6 items-center justify-center rounded-full border bg-background">
            {ICONS[item.kind]}
          </span>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="font-medium">{item.title}</span>
            <time className="text-xs text-muted-foreground" title={formatDate(item.at)}>
              {formatRelative(item.at)}
            </time>
          </div>
          {item.detail && <p className="text-muted-foreground">{item.detail}</p>}
        </li>
      ))}
    </ol>
  );
}
