import type { ReactNode } from "react";

import { ADMIN_CARD } from "./styles";

export function AdminSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-heading">{title}</h2>
      <div className={ADMIN_CARD}>{children}</div>
    </section>
  );
}
