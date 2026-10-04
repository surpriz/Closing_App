"use client";

import Link from "next/link";

import type { WorkspaceLiveState } from "@/lib/closing/live";

import { LiveDot } from "../heat";
import { useLivePoll } from "../use-live-poll";

/**
 * Who is reading right now, across every link. Also what keeps the dashboard
 * fresh: the page re-renders when the live stamp moves.
 */
export function LiveStrip({ initial }: { initial: WorkspaceLiveState }) {
  const { readers } = useLivePoll("/api/live", initial);

  if (readers.length === 0) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-card px-4 py-3 ring-1 ring-heat-hot/40"
    >
      <span className="flex items-center gap-2.5 text-body font-medium">
        <LiveDot />
        En train de lire
      </span>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {readers.map((reader) => (
          <li key={reader.viewId}>
            <Link href={`/links/${reader.linkId}`} className="font-medium hover:underline">
              {reader.label}
            </Link>
            {reader.name && reader.name !== reader.label && (
              <span className="text-muted-foreground">, {reader.name}</span>
            )}
            {reader.currentPage && <span className="text-muted-foreground">, page {reader.currentPage}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
