"use client";

import { ArrowRight, Lock } from "lucide-react";
import { useActionState, useState } from "react";

import type { UnlockState } from "@/app/v/[slug]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ViewerLabels } from "@/lib/closing/i18n/viewer";

import { GateBackdrop } from "./gate-backdrop";
import { PrivacyNotice } from "./privacy-notice";

type Props = {
  action: (prev: UnlockState, formData: FormData) => Promise<UnlockState>;
  /** The person the seller sent the link to: one click instead of a form. */
  known: { firstName: string | null; maskedEmail: string; unlock: () => Promise<UnlockState> } | null;
  documentName: string;
  senderName: string | null;
  labels: ViewerLabels;
};

export function EmailGate({ action, known, documentName, senderName, labels }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const [knownState, unlockKnown, unlocking] = useActionState(async () => known!.unlock(), null);
  const [notMe, setNotMe] = useState(false);
  const invalid = state?.error === "invalid_email";
  const greet = known && !notMe && !knownState?.error;

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-16">
      <GateBackdrop />

      <div className="relative w-full max-w-sm animate-rise rounded-2xl bg-card p-6 shadow-lg ring-1 ring-border sm:p-7">
        <span className="mb-5 flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground ring-1 ring-border">
          <Lock className="size-4.5" aria-hidden />
        </span>
        <h1 className="text-heading">
          {greet && known.firstName ? labels.greeting.replace("{name}", known.firstName) : labels.emailTitle}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{documentName}</span>
          {senderName && (
            <>
              {" · "}
              {labels.sharedBy} {senderName}
            </>
          )}
        </p>
        {greet ? (
          <form action={unlockKnown} className="mt-6 space-y-3">
            <p className="text-sm text-muted-foreground">{labels.sentTo.replace("{email}", known.maskedEmail)}</p>
            <Button type="submit" size="xl" className="w-full" disabled={unlocking} autoFocus>
              {labels.emailSubmit}
              <ArrowRight data-icon="inline-end" />
            </Button>
            <button
              type="button"
              onClick={() => setNotMe(true)}
              className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {labels.notMe}
            </button>
            <PrivacyNotice labels={labels} />
          </form>
        ) : (
          <EmailForm action={formAction} pending={pending} invalid={invalid} labels={labels} />
        )}
      </div>
    </main>
  );
}

function EmailForm({
  action,
  pending,
  invalid,
  labels,
}: {
  action: (formData: FormData) => void;
  pending: boolean;
  invalid: boolean;
  labels: ViewerLabels;
}) {
  return (
    <>
      <p className="mt-3 text-sm text-muted-foreground">{labels.emailDescription}</p>

      <form action={action} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">{labels.emailLabel}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            className="h-11"
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? "email-error" : undefined}
          />
          {invalid && (
            <p id="email-error" className="text-sm text-destructive">
              {labels.invalidEmail}
            </p>
          )}
        </div>
        <Button type="submit" size="xl" className="w-full" disabled={pending}>
          {labels.emailSubmit}
          <ArrowRight data-icon="inline-end" />
        </Button>
        <PrivacyNotice labels={labels} />
      </form>
    </>
  );
}
