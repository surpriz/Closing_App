"use client";

import { useLocale, useTranslations } from "next-intl";

import { segmentLabel } from "@/lib/closing/documents/video-segments";
import type { LinkLiveState } from "@/lib/closing/live";

import { LiveDot } from "./heat";
import { useLivePoll } from "./use-live-poll";

const DEVICES = new Set(["mobile", "tablet", "desktop"]);

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
  const t = useTranslations("common.liveActivity");
  const locale = useLocale();

  // Nothing to say while nobody reads: the poll above still refreshes the page
  if (readers.length === 0) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-foreground bg-card px-4 py-3"
    >
      <span className="flex items-center gap-2.5 text-body font-medium">
        <LiveDot />
        {readers.length === 1 ? t("readingOne") : t("readingMany", { count: readers.length })}
      </span>
      <ul className="flex flex-wrap gap-x-6 gap-y-1 text-small">
        {readers.map((reader) => (
          <li key={reader.viewId}>
            <span className="font-medium">{reader.name ?? t("anonymous")}</span>
            <span className="text-muted-foreground">
              {[
                pageCount && reader.currentPage
                  ? video
                    ? t("videoAt", { segment: segmentLabel(reader.currentPage, pageCount, locale) })
                    : t("page", { page: reader.currentPage, total: pageCount })
                  : null,
                reader.deviceType && DEVICES.has(reader.deviceType)
                  ? t(`device.${reader.deviceType as "mobile" | "tablet" | "desktop"}`)
                  : null,
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
