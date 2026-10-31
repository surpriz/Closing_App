import { Icon } from "./icons";
import { HeatScale, ThermalPlate } from "./thermal-plate";

type Row = { when: string; text: string; badge?: string; action?: string };

/**
 * The campaigns section's figure: one prospect's path through a sequence, as the report logs it.
 * Two fixed emails go out cold, the pricing read heats the row and pauses the sequence, then the
 * follow-up Clozer wrote waits for approval and the planned third email is dropped. Decorative;
 * the caption carries the reading.
 */
export function ThermalSequence({
  name,
  caption,
  rows,
  labels,
}: {
  name: string;
  caption: string;
  rows: { step1: Row; step2: Row; read: Row; followUp: Row; cancelled: Row };
  labels: { example: string; hot: string; cold: string };
}) {
  const plate = (kind: "cold" | "hot" | "none" | "cancelled") =>
    kind === "hot" ? (
      <ThermalPlate heat={0.94} seed={3} className="aspect-[3/4] w-7 shrink-0 self-center" />
    ) : kind === "cold" ? (
      <span aria-hidden className="block aspect-[3/4] w-7 shrink-0 self-center border border-rule bg-muted" />
    ) : kind === "cancelled" ? (
      <span aria-hidden className="hatch block aspect-[3/4] w-7 shrink-0 self-center text-rule" />
    ) : (
      <span aria-hidden className="block aspect-[3/4] w-7 shrink-0 self-center" />
    );

  const line = (key: string, row: Row, kind: "cold" | "hot" | "none" | "cancelled") => (
    <li key={key} className={`grid grid-cols-[6.5rem_1.75rem_minmax(0,1fr)] items-center gap-3 border-b border-rule px-4 py-3.5 sm:grid-cols-[7.5rem_1.75rem_minmax(0,1fr)] ${kind === "hot" ? "bg-paper" : ""}`}>
      <span className="font-mono text-micro text-ink-soft">{row.when}</span>
      {plate(kind)}
      <span className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className={`text-small sm:text-body ${kind === "cancelled" ? "text-ink-soft line-through" : kind === "hot" || row.action ? "font-medium" : ""}`}>
          {row.text}
        </span>
        {row.badge && (
          <span className="flex items-center gap-2 border border-ink px-2 py-1 font-mono text-micro whitespace-nowrap">
            <span className="size-2 bg-iron-2" aria-hidden />
            {row.badge}
          </span>
        )}
        {row.action && (
          <span className="flex h-8 items-center gap-2 bg-ink px-3 text-small font-semibold text-sheet">
            {row.action}
            <Icon name="arrow" className="size-4" />
          </span>
        )}
      </span>
    </li>
  );

  return (
    <figure className="border border-ink bg-sheet">
      <figcaption className="sr-only">{caption}</figcaption>
      <div aria-hidden>
        <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink px-4 py-2.5 text-small">
          <span className="font-mono text-micro">{name}</span>
          <span className="shrink-0 text-micro text-ink-soft">{labels.example}</span>
        </p>
        <ol>
          {line("step1", rows.step1, "cold")}
          {line("step2", rows.step2, "cold")}
          {line("read", rows.read, "hot")}
          {line("followUp", rows.followUp, "none")}
          {line("cancelled", rows.cancelled, "cancelled")}
        </ol>
        <p className="flex items-center gap-3 px-4 py-3 font-mono text-micro text-ink-soft">
          <span>{labels.cold}</span>
          <HeatScale orientation="horizontal" className="max-w-56 flex-1" />
          <span>{labels.hot}</span>
        </p>
      </div>
    </figure>
  );
}
