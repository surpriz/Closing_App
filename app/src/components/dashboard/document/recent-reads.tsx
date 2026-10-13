export type RecentReadRow = {
  id: string;
  reader: string;
  deal: string;
  /** Place, time zone, device: what the browser told us. */
  where: string;
  duration: string;
  when: string;
  /** Full date, on hover. */
  at: string;
};

/** The latest readings, newest first: who, for which deal, how long. */
export function RecentReads({ rows }: { rows: RecentReadRow[] }) {
  return (
    <ul className="divide-y divide-border border-y border-foreground bg-card">
      {rows.map((row) => (
        <li key={row.id} className="flex items-start justify-between gap-4 px-3 py-3 text-small sm:px-4">
          <div className="min-w-0">
            <p className="font-medium">
              {row.reader}
              <span className="font-normal text-muted-foreground"> pour {row.deal}</span>
            </p>
            {row.where && <p className="truncate text-muted-foreground">{row.where}</p>}
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono">{row.duration}</p>
            <p className="text-muted-foreground" title={row.at}>
              {row.when}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
