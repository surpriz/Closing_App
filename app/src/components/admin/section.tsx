import type { ReactNode } from "react";

export function AdminSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-heading">{title}</h2>
      <div className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-border">{children}</div>
    </section>
  );
}
