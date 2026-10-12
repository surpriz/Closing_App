"use client";

import { BookOpen, CircleHelp, Compass, LifeBuoy, MessageCircleQuestion } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { openHelp } from "./open-help";

/** Everything about how Clozer works, behind one "?" in the header. */
export function HelpMenu() {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Aide"
        title="Aide"
        data-help-launcher
        className="flex size-9 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-foreground/[0.04] hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        <CircleHelp className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem onClick={openHelp}>
          <MessageCircleQuestion />
          Poser une question
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/comment-ca-marche")}>
          <BookOpen />
          Comment ça marche
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/faq")}>
          <LifeBuoy />
          Questions fréquentes
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/bienvenue")}>
          <Compass />
          Revoir la prise en main
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
