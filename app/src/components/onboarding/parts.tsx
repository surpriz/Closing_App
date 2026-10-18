export function StepHeading({ title, lead }: { title: React.ReactNode; lead?: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h1 className="condensed text-title text-balance sm:text-display">{title}</h1>
      {lead && <p className="max-w-xl text-body text-muted-foreground">{lead}</p>}
    </div>
  );
}

/** Numbered instructions, one short line each, with an optional slot under a line. */
export function Instructions({ items }: { items: { text: React.ReactNode; extra?: React.ReactNode }[] }) {
  return (
    <ol className="space-y-4">
      {items.map((item, index) => (
        <li key={index} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3">
          <span className="flex size-7 items-center justify-center border border-foreground font-mono text-small font-medium">
            {index + 1}
          </span>
          <div className="space-y-3 pt-0.5 text-body">
            <p>{item.text}</p>
            {item.extra}
          </div>
        </li>
      ))}
    </ol>
  );
}
