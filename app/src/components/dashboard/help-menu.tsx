"use client";

import { BookOpen, CircleHelp, Compass, LifeBuoy, MessageCircleQuestion } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("nav.helpMenu");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("label")}
        title={t("label")}
        data-help-launcher
        className="flex size-9 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 aria-expanded:bg-muted aria-expanded:text-foreground"
      >
        <CircleHelp className="size-5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem onClick={openHelp}>
          <MessageCircleQuestion />
          {t("ask")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/how-it-works")}>
          <BookOpen />
          {t("howItWorks")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/faq")}>
          <LifeBuoy />
          {t("faq")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/welcome")}>
          <Compass />
          {t("replayTour")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
