"use client";

import { useState, type ComponentProps } from "react";

/**
 * A `<details>` whose initial state is decided once: a server re-render (after an import, a save)
 * must not snap shut the fold the seller is reading. The browser still toggles it freely.
 */
export function DetailsFold({ defaultOpen = false, ...props }: Omit<ComponentProps<"details">, "open"> & { defaultOpen?: boolean }) {
  const [open] = useState(() => defaultOpen);
  return <details {...props} open={open} />;
}
