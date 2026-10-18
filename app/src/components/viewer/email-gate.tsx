"use client";

import { ArrowRight } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

import type { UnlockState } from "@/app/v/[slug]/actions";
import { Button } from "@/components/ui/button";
import type { ViewerLabels } from "@/lib/closing/i18n/viewer";

import { GATE_BOX, GATE_FIELD, GATE_LABEL, GATE_SUBMIT, GateFrame, GateTitle } from "./gate-frame";
import { PrivacyNotice } from "./privacy-notice";

type Props = {
  slug: string;
  action: (prev: UnlockState, formData: FormData) => Promise<UnlockState>;
  /** The person the seller sent the link to: one click instead of a form. */
  known: { firstName: string | null; maskedEmail: string; unlock: () => Promise<UnlockState> } | null;
  documentName: string;
  senderName: string | null;
  labels: ViewerLabels;
};

export function EmailGate({ slug, action, known, documentName, senderName, labels }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const [knownState, unlockKnown, unlocking] = useActionState(async () => known!.unlock(), null);
  const [notMe, setNotMe] = useState(false);
  const invalid = state?.error === "invalid_email";
  const greet = known && !notMe && !knownState?.error;

  // Shown in a real browser: the link was clicked, whether or not the reader goes on
  useEffect(() => {
    navigator.sendBeacon?.("/api/track/gate", new Blob([JSON.stringify({ slug })], { type: "application/json" }));
  }, [slug]);

  return (
    <GateFrame>
      <GateTitle documentName={documentName} senderName={senderName} labels={labels} />

      {greet ? (
        <>
          <form action={unlockKnown} className={`mt-8 ${GATE_BOX}`}>
            <div className="border-b border-border px-3 py-3">
              <p className="text-body font-semibold">
                {known.firstName ? labels.greeting.replace("{name}", known.firstName) : labels.emailTitle}
              </p>
              <p className="text-small text-muted-foreground">
                {labels.sentTo.replace("{email}", known.maskedEmail)}
              </p>
            </div>
            <Button type="submit" size="xl" className={GATE_SUBMIT} disabled={unlocking} autoFocus>
              {labels.emailSubmit}
              <ArrowRight data-icon="inline-end" />
            </Button>
          </form>
          <Button variant="ghost" className="mt-2 h-11 w-full text-muted-foreground" onClick={() => setNotMe(true)}>
            {labels.notMe}
          </Button>
        </>
      ) : (
        <form action={formAction} className="mt-8">
          <div className={GATE_BOX}>
            <label htmlFor="email" className={GATE_LABEL}>
              {labels.emailLabel}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              className={GATE_FIELD}
              aria-invalid={invalid || undefined}
              aria-describedby={invalid ? "email-error" : undefined}
            />
            <Button type="submit" size="xl" className={GATE_SUBMIT} disabled={pending}>
              {labels.emailSubmit}
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
          {invalid && (
            <p id="email-error" role="alert" className="mt-2 text-small text-destructive">
              {labels.invalidEmail}
            </p>
          )}
        </form>
      )}

      <PrivacyNotice labels={labels} className="mt-6" />
    </GateFrame>
  );
}
