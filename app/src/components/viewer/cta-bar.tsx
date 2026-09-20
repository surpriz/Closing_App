"use client";

import { CheckCircle2 } from "lucide-react";
import { useState, useTransition } from "react";

import { submitProspectAction } from "@/app/v/[slug]/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { DealStatus } from "@/generated/prisma/enums";
import type { ViewerLabels } from "@/lib/closing/i18n/viewer";

type Props = {
  slug: string;
  labels: ViewerLabels;
  initialStatus: DealStatus;
  getViewId: () => string | null;
};

export function CtaBar({ slug, labels, initialStatus, getViewId }: Props) {
  const [status, setStatus] = useState<DealStatus>(initialStatus);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(type: "VALIDATE_SIGN" | "REQUEST_CHANGE") {
    setError(false);
    startTransition(async () => {
      const result = await submitProspectAction({
        slug,
        viewId: getViewId(),
        type,
        message: type === "REQUEST_CHANGE" ? message : undefined,
      });
      if (!result.ok) {
        setError(true);
        return;
      }
      setStatus(type === "VALIDATE_SIGN" ? "VALIDATED" : "CHANGE_REQUESTED");
      setEditing(false);
      setMessage("");
    });
  }

  const done = status === "VALIDATED" || status === "WON";

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur">
      <div className="mx-auto max-w-4xl space-y-2 px-4 py-3">
        {done ? (
          <p className="flex items-center justify-center gap-2 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="size-4" /> {labels.validated}
          </p>
        ) : editing ? (
          <div className="space-y-2">
            <Textarea
              autoFocus
              rows={3}
              value={message}
              placeholder={labels.changePlaceholder}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
                {labels.cancel}
              </Button>
              <Button
                onClick={() => submit("REQUEST_CHANGE")}
                disabled={pending || message.trim().length === 0}
              >
                {labels.send}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            {status === "CHANGE_REQUESTED" && (
              <p className="text-sm text-muted-foreground sm:mr-auto">{labels.changeRequested}</p>
            )}
            <Button variant="outline" size="lg" onClick={() => setEditing(true)} disabled={pending}>
              {labels.requestChange}
            </Button>
            <Button
              size="lg"
              disabled={pending}
              onClick={() => {
                if (window.confirm(labels.confirmValidate)) submit("VALIDATE_SIGN");
              }}
            >
              {labels.validate}
            </Button>
          </div>
        )}
        {error && <p className="text-center text-sm text-destructive">{labels.actionError}</p>}
      </div>
    </div>
  );
}
