"use client";

import { Pause } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

import { pauseAutopilot } from "@/app/(dashboard)/settings/actions";
import { Button } from "@/components/ui/button";

export function AutopilotBanner({ sentToday, canPause }: { sentToday: number; canPause: boolean }) {
  const [pending, startTransition] = useTransition();
  const t = useTranslations("today.autopilot");

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-y border-foreground bg-card px-4 py-3 text-body">
      <p>
        <span className="font-medium">{t("mode")}</span>{" "}
        <span className="text-muted-foreground">
          {sentToday === 0 ? t("none") : t("sent", { count: sentToday })}
        </span>
      </p>
      {canPause && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await pauseAutopilot();
              toast.success(t("pausedToast"));
            })
          }
        >
          <Pause /> {t("pause")}
        </Button>
      )}
    </div>
  );
}
