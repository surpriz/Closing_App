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
    // A second click on the same "#id" link changes no hash: catch the click itself
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.(`a[href$="#${id}"]`);
      if (link) requestAnimationFrame(open);
    };
    open();
    window.addEventListener("hashchange", open);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", open);
      document.removeEventListener("click", onClick);
    };
  }, [id]);
  return null;
}
