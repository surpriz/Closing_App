"use client";

import { ChevronRight, FlaskConical } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  runOutreachTickAction,
  shiftMailboxRampAction,
  timeTravelEnrollmentAction,
} from "@/app/(dashboard)/campaigns/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Rendered only when the server says test tools are on (local dev, staging), never in production
export function CampaignTestTools({
  enrollments,
  mailboxId,
}: {
  enrollments: { id: string; email: string }[];
  mailboxId: string | null;
}) {
  const t = useTranslations("campaigns.testTools");
  const [pending, startTransition] = useTransition();
  const [tick, setTick] = useState<string | null>(null);
  const [enrollmentId, setEnrollmentId] = useState(enrollments[0]?.id ?? "");
  const [enrollmentDays, setEnrollmentDays] = useState(1);
  const [mailboxDays, setMailboxDays] = useState(7);
  const enrollmentItems = enrollments.map((item) => ({ value: item.id, label: item.email }));

  const report = (result: { ok: true; notice?: string } | { error: string }) => {
    if ("error" in result) toast.error(result.error);
    else if (result.notice) toast.success(result.notice);
  };

  return (
    <details className="group text-small text-muted-foreground">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 outline-none hover:text-foreground focus-visible:underline [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
        <FlaskConical className="size-3.5" /> {t("title")}
      </summary>
      <div className="mt-3 space-y-4">
        <div className="space-y-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => startTransition(async () => setTick(await runOutreachTickAction()))}
          >
            {pending ? t("running") : t("runTick")}
          </Button>
          {tick && <pre className="overflow-x-auto bg-muted px-3 py-2 font-mono text-micro text-foreground">{tick}</pre>}
        </div>

        {enrollments.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span>{t("shiftEnrollment")}</span>
            <Select
              items={enrollmentItems}
              value={enrollmentId}
              onValueChange={(value) => value && setEnrollmentId(value)}
            >
              <SelectTrigger aria-label={t("prospect")} size="sm" className="w-56 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {enrollmentItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={1}
              max={60}
              aria-label={t("days")}
              value={enrollmentDays}
              onChange={(event) => setEnrollmentDays(event.target.valueAsNumber)}
              className="w-20"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={pending || !enrollmentId || !(enrollmentDays >= 1)}
              onClick={() =>
                startTransition(async () => report(await timeTravelEnrollmentAction(enrollmentId, enrollmentDays)))
              }
            >
              {t("apply")}
            </Button>
          </div>
        )}

        {mailboxId && (
          <div className="flex flex-wrap items-center gap-2">
            <span>{t("shiftMailbox")}</span>
            <Input
              type="number"
              min={1}
              max={60}
              aria-label={t("days")}
              value={mailboxDays}
              onChange={(event) => setMailboxDays(event.target.valueAsNumber)}
              className="w-20"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={pending || !(mailboxDays >= 1)}
              onClick={() => startTransition(async () => report(await shiftMailboxRampAction(mailboxId, mailboxDays)))}
            >
              {t("apply")}
            </Button>
          </div>
        )}
      </div>
    </details>
  );
}
