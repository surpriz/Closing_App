import { HeatStrip } from "@/components/dashboard/heat-strip";
import type { PageHeat } from "@/lib/closing/dashboard/page-heat";

import { HottestReading } from "./reading-bits";

/**
 * The document's reading at a glance: every prospect's reading folded into one thermal
 * strip, then the measured fields beside it. Shown once someone has read.
 */
export function ReadingFields({
  heat,
  video,
  fields,
}: {
  /** Null for a web page: one reading, no pages to heat. */
  heat: PageHeat | null;
  video: boolean;
  fields: { label: string; value: string }[];
}) {
  return (
    <div className="grid gap-x-10 gap-y-4 border-y border-foreground py-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
      {heat && (
        <div className="space-y-2">
          <HeatStrip heat={heat} />
          <p className="text-small text-muted-foreground">
            <HottestReading heat={heat} video={video} />
          </p>
        </div>
      )}
      <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
        {fields.map((field) => (
          <div key={field.label} className="min-w-0 space-y-0.5">
            <dt className="text-small text-muted-foreground">{field.label}</dt>
            <dd className="truncate font-mono text-heading font-medium">{field.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
