"use client";

import { useEffect } from "react";

/**
 * Opens the folded <details id={id}> when the address points at it, on arrival or later
 * (a "Noter l'appel" button linking to "#noter"): a link must not land on a closed fold.
 */
export function OpenOnHash({ id }: { id: string }) {
  useEffect(() => {
    const open = () => {
      if (window.location.hash !== `#${id}`) return;
      const element = document.getElementById(id);
      if (element instanceof HTMLDetailsElement) element.open = true;
      element?.scrollIntoView({ block: "start" });
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, [id]);
  return null;
}
