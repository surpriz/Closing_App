import Link from "next/link";

import { CopyButton } from "@/components/dashboard/copy-button";
import { HeatStrip } from "@/components/dashboard/heat-strip";
import { LinkFollowupsToggle } from "@/components/dashboard/link-followups-toggle";
import type { EngagementTier } from "@/generated/prisma/enums";
import type { PageHeat } from "@/lib/closing/dashboard/page-heat";

import { HottestReading, StateMark } from "./reading-bits";

export type ProspectLinkRow = {
  id: string;
  label: string;
  /** Contact details under the name, or when the link was made. */
  contact: string;
  /** "Chaud", "Validé", "Expiré", "Pas encore ouvert"… */
  state: string;
  tier: EngagementTier | null;
  signed: boolean;
  /** A reading or a decision to read off: the state is set in ink. */
  strong: boolean;
  views: number;
  /** Reading time per page, null while the link was never opened. */
  heat: PageHeat | null;
  url: string;
  followupsEnabled: boolean;
};

/** One link per prospect, each led by its pages at the thermal camera. */
export function DocumentLinks({ rows, video }: { rows: ProspectLinkRow[]; video: boolean }) {
  return (
    <ul className="stagger divide-y divide-border border-y border-foreground bg-card">
      {rows.map((row) => (
        <li
          key={row.id}
          className="group relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 px-3 py-4 transition-colors duration-150 hover:bg-muted/60 sm:grid-cols-[7.25rem_minmax(0,1fr)_auto] sm:px-4"
        >
          <HeatStrip heat={row.heat} className="col-span-2 sm:col-span-1" />
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <Link
                href={`/links/${row.id}`}
                className="min-w-0 truncate font-semibold outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/30 focus-visible:after:ring-inset"
              >
                {row.label}
              </Link>
              <span className="flex shrink-0 items-center gap-1.5 text-small text-muted-foreground">
                <StateMark state={row.state} tier={row.tier} signed={row.signed} strong={row.strong} />
                <span>
                  · <span className="font-mono">{row.views}</span> {row.views === 1 ? "lecture" : "lectures"}
                </span>
              </span>
            </div>
            <p className="flex flex-wrap gap-x-2 text-small text-muted-foreground">
              <HottestReading heat={row.heat} video={video} />
              <span className="truncate">{row.contact}</span>
            </p>
          </div>
          <div className="relative z-10 flex items-center gap-3">
            <label className="flex items-center gap-2 text-small text-muted-foreground">
              <span className="hidden md:inline">Relances</span>
              <LinkFollowupsToggle linkId={row.id} enabled={row.followupsEnabled} />
            </label>
            <CopyButton value={row.url} />
          </div>
        </li>
      ))}
    </ul>
  );
}
