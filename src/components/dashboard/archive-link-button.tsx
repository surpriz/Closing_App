"use client";

import { Archive } from "lucide-react";
import { useTransition } from "react";

import { archiveLink } from "@/app/(dashboard)/links/actions";
import { Button } from "@/components/ui/button";

export function ArchiveLinkButton({ linkId }: { linkId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Archiver ce lien ? Il ne sera plus consultable par le prospect.")) return;
        startTransition(() => archiveLink(linkId));
      }}
    >
      <Archive /> Archiver
    </Button>
  );
}
