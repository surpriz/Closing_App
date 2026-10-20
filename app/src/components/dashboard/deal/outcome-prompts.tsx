"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

import { updateLostReason, updateMeetingOutcome } from "@/app/(dashboard)/links/actions";
import { Button } from "@/components/ui/button";
import type { DealCloseReason, MeetingOutcome } from "@/generated/prisma/enums";

const REASONS: DealCloseReason[] = ["PRICE", "TIMING", "COMPETITOR", "NO_DECISION", "NO_NEED", "OTHER"];
const OUTCOMES: MeetingOutcome[] = ["HELD", "NO_SHOW", "CANCELLED"];

function Prompt({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-l-2 border-foreground py-1 pl-3 text-small sm:flex-row sm:items-center sm:gap-4">
      <p className="font-medium">{question}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/** The deal was marked lost: why, in one click. It feeds the "what works" page. */
export function LostReasonPrompt({ linkId }: { linkId: string }) {
  const [pending, startTransition] = useTransition();
  const t = useTranslations("deal.outcome");
  const tl = useTranslations("labels");

  return (
    <Prompt question={t("lostQuestion")}>
      {REASONS.map((reason) => (
        <Button
          key={reason}
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await updateLostReason(linkId, reason);
              toast.success(t("thanks"));
            })
          }
        >
          {tl(`closeReason.${reason}`)}
        </Button>
      ))}
    </Prompt>
  );
}

/** The booked meeting's date has passed: did it happen? A no-show hands the deal back to the follow-ups. */
export function MeetingOutcomePrompt({ linkId }: { linkId: string }) {
  const [pending, startTransition] = useTransition();
  const t = useTranslations("deal.outcome");
  const tl = useTranslations("labels");

  return (
    <Prompt question={t("meetingQuestion")}>
      {OUTCOMES.map((outcome) => (
        <Button
          key={outcome}
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await updateMeetingOutcome(linkId, outcome);
              toast.success(outcome === "HELD" ? t("thanks") : t("followupsBack"));
            })
          }
        >
          {tl(`meetingOutcome.${outcome}`)}
        </Button>
      ))}
    </Prompt>
  );
}
