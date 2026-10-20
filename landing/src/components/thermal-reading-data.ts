// The four pages of the sample proposal (app/public/onboarding/exemple-devis.pdf), as one example reading.
export const READING_PAGES = [
  { key: "cover", time: "0:14", heat: 0.3 },
  { key: "scope", time: "1:12", heat: 0.62 },
  { key: "timeline", time: "0:41", heat: 0.45 },
  { key: "pricing", time: "3:38", heat: 1 },
] as const;

export const HOTTEST_PAGE = READING_PAGES.reduce((hottest, page, i) => (page.heat > READING_PAGES[hottest].heat ? i : hottest), 0);

export type ReadingPage = { label: string; heading: string; time: string; heat: number };
