"use client";

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
}: {
  linkId: string;
  initial: LinkLiveState;
  /** Null for web documents, which have no pages. */
  pageCount: number | null;
}) {
  const { readers } = useLivePoll(`/api/links/${linkId}/live`, initial);

  if (readers.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="size-1.5 rounded-full bg-foreground/25" />
        Personne ne lit en ce moment. Dès qu&apos;un lecteur ouvre le document, ça s&apos;affiche ici (en
        quelques secondes).
      </p>
    );
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-card px-4 py-3 ring-1 ring-heat-hot/40"
    >
      <span className="flex items-center gap-2.5 text-[15px] font-medium">
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
                  ? `page ${reader.currentPage} sur ${pageCount}`
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
