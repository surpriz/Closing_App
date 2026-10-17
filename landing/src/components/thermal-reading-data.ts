// Example readings, labelled as such on the page. One per kind of document, same six-page frame.
// Titles and names come from messages (reading.documents.<key>), built by the page.
export const READING_DOCUMENTS = [
  {
    key: "quote",
    hottest: 3,
    pages: [
      { time: "0:14", heat: 0.3 },
      { time: "0:41", heat: 0.5 },
      { time: "1:12", heat: 0.68 },
      { time: "3:38", heat: 1 },
      { time: "0:22", heat: 0.38 },
      { time: "—", heat: 0 },
    ],
  },
  {
    key: "deck",
    hottest: 2,
    pages: [
      { time: "0:09", heat: 0.2 },
      { time: "0:52", heat: 0.5 },
      { time: "2:47", heat: 1 },
      { time: "1:30", heat: 0.74 },
      { time: "0:18", heat: 0.32 },
      { time: "—", heat: 0 },
    ],
  },
  {
    key: "tech",
    hottest: 2,
    pages: [
      { time: "0:11", heat: 0.25 },
      { time: "0:34", heat: 0.45 },
      { time: "4:05", heat: 1 },
      { time: "2:10", heat: 0.8 },
      { time: "0:40", heat: 0.5 },
      { time: "0:05", heat: 0.1 },
    ],
  },
  {
    key: "invoice",
    hottest: 3,
    pages: [
      { time: "0:48", heat: 0.62 },
      { time: "1:05", heat: 0.78 },
      { time: "0:20", heat: 0.35 },
      { time: "1:41", heat: 1 },
      { time: "0:06", heat: 0.12 },
      { time: "0:15", heat: 0.3 },
    ],
  },
  {
    // A recorded pitch: each plate is 30 seconds of the video, the figure is how many times it was watched.
    key: "video",
    video: true,
    hottest: 3,
    pages: [
      { at: "0:00", time: "1×", heat: 0.3 },
      { at: "0:30", time: "1×", heat: 0.42 },
      { at: "1:00", time: "2×", heat: 0.78 },
      { at: "1:30", time: "3×", heat: 1 },
      { at: "2:00", time: "1×", heat: 0.55 },
      { at: "2:30", time: "—", heat: 0 },
    ],
  },
] as const;

export type ReadingDocument = {
  tab: string;
  name: string;
  /** Screen-reader summary of the reading. */
  caption: string;
  video: boolean;
  hottest: number;
  pages: { title: string; time: string; heat: number; at?: string }[];
};
