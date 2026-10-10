import type { LucideIcon } from "lucide-react";

export function StepHeading({ title, lead }: { title: React.ReactNode; lead?: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h1 className="text-title text-balance [font-stretch:88%] sm:text-display">{title}</h1>
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
          <span className="flex size-7 items-center justify-center rounded-full bg-muted font-mono text-small font-medium text-muted-foreground ring-1 ring-border">
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

/** An icon, a title, a sentence: the building block of the explanation screens. */
export function IconRow({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4">
      <span className="flex size-10 items-center justify-center rounded-full bg-foreground/[0.06]">
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <div className="space-y-1 pt-1.5">
        <p className="font-medium">{title}</p>
        <p className="text-body text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}
