import { HeatScale, ThermalPlate } from "@/components/brand/thermal-plate";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  formatClock,
  type DealPlate,
  type DealPlates,
} from "@/lib/closing/dashboard/deal-plates";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

import { LiveDot } from "../heat";

/**
 * The prospect's reading as a thermal image: each page of the document seen
 * through the camera, heated by the time spent on it, the reticle on the
 * most-read one. Grey sheets until the link is first opened.
 */
export function ThermalBand({
  plates,
  opened,
  video,
  children,
}: {
  plates: DealPlates;
  opened: boolean;
  video: boolean;
  /** The detailed chart, folded under the band. */
  children?: React.ReactNode;
}) {
  const count = plates.plates.length;
  const maxSeconds = Math.max(
    0,
    ...plates.plates.map((plate) => plate.seconds),
  );
  const hottest = plates.plates.find((plate) => plate.hottest);
  const unit = video ? "passage" : "page";

  return (
    <section aria-labelledby="lecture-titre" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-foreground pb-2">
        <h2 id="lecture-titre" className="text-heading">
          {video ? "Lecture passage par passage" : "Lecture page par page"}
        </h2>
        <p className="font-mono text-micro text-muted-foreground">
          {hottest && plates.hottest ? (
            <>
              <span className="text-foreground">
                {video ? hottest.label : `P.${plates.hottest.page}`}{" "}
                {video ? "le plus regardé" : "la plus lue"}
              </span>{" "}
              · {formatClock(plates.hottest.seconds)}
            </>
          ) : opened ? (
            `Aucun temps mesuré par ${unit}`
          ) : (
            "Pas encore ouvert"
          )}
        </p>
      </div>

      <ol
        className="grid grid-cols-[repeat(var(--n-phone),minmax(0,1fr))] gap-px sm:grid-cols-[repeat(var(--n-sm),minmax(0,1fr))] lg:grid-cols-[repeat(var(--n),minmax(0,1fr))]"
        style={
          {
            "--n-phone": Math.min(count, 5),
            "--n-sm": Math.min(count, 6),
            "--n": count,
            // A short document keeps report-size sheets instead of stretching them across the page
            maxWidth: `${count * 8}rem`,
          } as React.CSSProperties
        }
      >
        {plates.plates.map((plate) => (
          <li key={plate.index} className="min-w-0">
            <Plate plate={plate} opened={opened} video={video} />
          </li>
        ))}
      </ol>

      {opened ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-micro text-muted-foreground">
          <span className="flex items-center gap-2">
            0:00
            <HeatScale className="w-28 sm:w-40" />
            {formatClock(maxSeconds)}
          </span>
          <span>
            {formatClock(plates.totalSeconds)} sur{" "}
            {video ? "la vidéo" : "les pages"}
          </span>
          {plates.pagesPerPlate > 1 && (
            <span>{plates.pagesPerPlate} pages par plaque</span>
          )}
        </div>
      ) : (
        <p className="text-small text-muted-foreground">
          {video ? "Les passages chaufferont" : "Les pages chaufferont"} ici dès
          la première lecture.
        </p>
      )}

      {children}
    </section>
  );
}

function Plate({
  plate,
  opened,
  video,
}: {
  plate: DealPlate;
  opened: boolean;
  video: boolean;
}) {
  const what = video
    ? `Passage ${plate.label}`
    : plate.from === plate.to
      ? `Page ${plate.from}`
      : `Pages ${plate.from} à ${plate.to}`;
  const description = [
    what,
    opened ? `${formatDuration(plate.seconds * 1000)} de lecture` : null,
    plate.pricing ? "tarifs" : null,
    plate.hottest ? (video ? "le plus regardé" : "la plus lue") : null,
    plate.live ? "lue en ce moment" : null,
  ]
    .filter(Boolean)
    .join(", ");

  const sheet = (
    <>
      {opened ? (
        <ThermalPlate
          heat={plate.heat}
          seed={plate.index}
          className="aspect-[3/4] w-full"
        >
          {plate.hottest && <Reticle />}
          {plate.live && <LiveDot className="absolute top-2 right-2" />}
        </ThermalPlate>
      ) : (
        <span aria-hidden className="block aspect-[3/4] w-full bg-muted" />
      )}
      <span
        aria-hidden
        className="mt-1.5 flex flex-col gap-0.5 pr-1 font-mono text-micro"
      >
        <span
          className={cn(
            "truncate",
            plate.hottest
              ? "font-semibold text-foreground"
              : "text-foreground/80",
          )}
        >
          {plate.label}
        </span>
        {opened && (
          <span
            className={
              plate.seconds > 0 ? "text-foreground" : "text-muted-foreground"
            }
          >
            {formatClock(plate.seconds)}
          </span>
        )}
      </span>
      {plate.pricing && (
        <span aria-hidden className="block text-micro text-muted-foreground">
          Tarifs
        </span>
      )}
      <span className="sr-only">{description}</span>
    </>
  );

  // The page's subject and its time per reading wait on hover or focus
  const details = [
    plate.summary,
    opened && plate.avgSeconds !== null && plate.seconds > 0
      ? `${formatDuration(plate.avgSeconds * 1000)} par ${video ? "visionnage" : "lecture"} en moyenne`
      : null,
  ].filter(Boolean);
  if (details.length === 0) return <div>{sheet}</div>;

  return (
    <Tooltip>
      <TooltipTrigger
        render={<div tabIndex={0} />}
        className="block outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {sheet}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="block max-w-64 space-y-1 py-2">
        <span className="block font-medium">{what}</span>
        {details.map((line) => (
          <span key={line} className="block opacity-80">
            {line}
          </span>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}

/** The measuring frame on the hottest page: a square with crosshair arms. */
function Reticle() {
  return (
    <span aria-hidden className="absolute inset-[22%] border border-white">
      <span className="absolute top-1/2 -left-[18%] h-px w-[18%] bg-white" />
      <span className="absolute top-1/2 -right-[18%] h-px w-[18%] bg-white" />
      <span className="absolute -top-[14%] left-1/2 h-[14%] w-px bg-white" />
      <span className="absolute -bottom-[14%] left-1/2 h-[14%] w-px bg-white" />
    </span>
  );
}
