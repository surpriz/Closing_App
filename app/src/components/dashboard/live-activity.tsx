"use client";

import { segmentLabel } from "@/lib/closing/documents/video-segments";
import type { LinkLiveState } from "@/lib/closing/live";

import { LiveDot } from "./heat";
import { useLivePoll } from "./use-live-poll";

const DEVICE_LABELS: Record<string, string> = {
  mobile: "sur mobile",
  tablet: "sur tablette",
  desktop: "sur ordinateur",
};

/**
 * Shows who is reading the link right now, and re-renders the server page as
 * soon as new reading data, a follow-up or an alert lands.
 */
export function LiveActivity({
  linkId,
  initial,
  pageCount,
  video = false,
}: {
  linkId: string;
  initial: LinkLiveState;
  /** Null for web documents, which have no pages. */
  pageCount: number | null;
  /** A video pitch: its pages are tenths of the video. */
  video?: boolean;
}) {
  const { readers } = useLivePoll(`/api/links/${linkId}/live`, initial);

  // Nothing to say while nobody reads: the poll above still refreshes the page
  if (readers.length === 0) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-card px-4 py-3 ring-1 ring-heat-hot/40"
    >
      <span className="flex items-center gap-2.5 text-body font-medium">
        <LiveDot />
        {readers.length === 1 ? "En train de lire" : `${readers.length} lecteurs en ce moment`}
      </span>
      <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {readers.map((reader) => (
          <li key={reader.viewId}>
            <span className="font-medium">{reader.name ?? "Lecteur anonyme"}</span>
            <span className="text-muted-foreground">
              {[
                pageCount && reader.currentPage
                  ? video
                    ? `vers ${segmentLabel(reader.currentPage, pageCount)} de la vidéo`
                    : `page ${reader.currentPage} sur ${pageCount}`
                  : null,
                reader.deviceType ? DEVICE_LABELS[reader.deviceType] : null,
              ]
                .filter(Boolean)
                .map((part) => `, ${part}`)
                .join("")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
