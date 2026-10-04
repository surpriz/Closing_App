"use client";

import { PenLine } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { prepareFollowupFromInsight } from "@/app/(dashboard)/links/actions";
import { Button } from "@/components/ui/button";

export function PrepareFollowupButton({ linkId }: { linkId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await prepareFollowupFromInsight(linkId);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Relance prête, relisez-la plus bas");
          document.getElementById("relances")?.scrollIntoView({ behavior: "smooth" });
        })
      }
    >
      <PenLine /> {pending ? "Rédaction…" : "Préparer une relance"}
    </Button>
  );
}
