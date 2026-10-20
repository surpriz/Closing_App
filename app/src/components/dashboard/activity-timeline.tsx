import {
  BellRing,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Eye,
  Forward,
  Hourglass,
  Link2,
  Mail,
  MessageCircleQuestion,
  MessageSquare,
  Mic,
  Phone,
  PlayCircle,
  Receipt,
  RotateCcw,
  Send,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { formatDate, formatRelative } from "@/lib/format";

export type TimelineItem = {
  id: string;
  at: Date;
  kind:
    | "created"
    | "view"
    | "validated"
    | "change"
    | "quote"
    | "extension"
    | "relink"
    | "meeting"
    | "meeting_click"
    | "question"
    | "voice"
    | "capsule"
    | "followup"
    | "alert"
    | "seller"
    | "reply"
    | "forward";
  title: string;
  detail?: string | null;
};

const ICONS: Record<TimelineItem["kind"], React.ReactNode> = {
  created: <Link2 className="size-3.5" />,
  view: <Eye className="size-3.5" />,
  validated: <CheckCircle2 className="size-3.5" />,
  change: <MessageSquare className="size-3.5" />,
  quote: <Receipt className="size-3.5" />,
  extension: <Hourglass className="size-3.5" />,
  relink: <RotateCcw className="size-3.5" />,
  meeting: <CalendarCheck className="size-3.5" />,
  meeting_click: <CalendarDays className="size-3.5" />,
  question: <MessageCircleQuestion className="size-3.5" />,
  voice: <Mic className="size-3.5" />,
  capsule: <PlayCircle className="size-3.5" />,
  followup: <Send className="size-3.5" />,
  alert: <BellRing className="size-3.5" />,
  seller: <Phone className="size-3.5" />,
  reply: <Mail className="size-3.5" />,
  forward: <Forward className="size-3.5" />,
};

export function ActivityTimeline({ items }: { items: TimelineItem[] }) {
  const t = useTranslations("deal.activityTimeline");
  const locale = useLocale();
  if (items.length === 0) {
    return <p className="text-small text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <ol className="relative space-y-4 border-l pl-6">
      {items.map((item) => (
        <li
          key={item.id}
          className="relative min-w-0 text-small [overflow-wrap:anywhere]"
        >
          <span className="absolute -left-[33px] flex size-6 items-center justify-center border bg-card">
            {ICONS[item.kind]}
          </span>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="min-w-0 text-body font-medium break-words [overflow-wrap:anywhere]">
              {item.title}
            </span>
            <time
              className="text-micro text-muted-foreground"
              title={formatDate(item.at, locale)}
            >
              {formatRelative(item.at, locale)}
            </time>
          </div>
          {item.detail && (
            <p className="text-muted-foreground">{item.detail}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
