import type { UiLocale } from "@/i18n/locale";
import { prisma } from "@/lib/db";
import { getNamespaceTranslator } from "@/lib/server-translator";

import { buildReaderMap, type ReaderMapNames } from "./reader-map";

/** Enough history to map a committee; older sessions add nothing to "who reads". */
const MAX_VIEWS = 500;

async function loadReaderInputs(linkId: string) {
  const [views, prospects] = await Promise.all([
    prisma.documentView.findMany({
      where: { linkId, isBot: false },
      orderBy: { startedAt: "desc" },
      take: MAX_VIEWS,
      select: {
        id: true,
        linkId: true,
        visitorId: true,
        prospectId: true,
        email: true,
        ipHash: true,
        deviceType: true,
        browser: true,
        os: true,
        startedAt: true,
        lastSeenAt: true,
        leftAt: true,
        totalDurationMs: true,
      },
    }),
    prisma.prospect.findMany({
      where: { linkId },
      select: { id: true, email: true, name: true, role: true, origin: true, createdAt: true },
    }),
  ]);
  return { views, prospects };
}

function readerMapNames(locale: UiLocale): ReaderMapNames {
  const t = getNamespaceTranslator(locale, "alerts.readerMap");
  return {
    unidentifiedReader: (letter) => t("unidentifiedReader", { letter }),
    unidentified: t("unidentified"),
    network: (n) => t("network", { n }),
    personal: t("personal"),
    unknownNetwork: t("unknownNetwork"),
  };
}

/** Who reads this proposal, for the "Qui lit" block of the deal page. `locale`: the seller's. */
export async function getReaderMap(linkId: string, now = new Date(), locale: UiLocale = "fr") {
  return buildReaderMap({ ...(await loadReaderInputs(linkId)), now, names: readerMapNames(locale) });
}
