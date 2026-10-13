"use client";

import { Check, Hourglass } from "lucide-react";
import { useActionState } from "react";

import type { ExtensionState } from "@/app/v/[slug]/actions";
import { Button } from "@/components/ui/button";
import type { ViewerLabels } from "@/lib/closing/i18n/viewer";

import { GATE_BOX, GATE_FIELD, GATE_LABEL, GATE_SUBMIT, GateFrame, GateTitle } from "./gate-frame";

type Props = {
  action: (prev: ExtensionState, formData: FormData) => Promise<ExtensionState>;
  documentName: string;
  senderName: string | null;
  labels: ViewerLabels;
  /** Quotes and proposals: "the price is no longer guaranteed" rather than "the link is off". */
  quote: boolean;
  /** "required" when the link asks for an email and we don't know the reader yet. */
  email: "required" | "optional" | "known";
  /** This reader already asked for this expiry date. */
  alreadyRequested: boolean;
};

export function LinkExpired({ action, documentName, senderName, labels, quote, email, alreadyRequested }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const sender = senderName ?? labels.chatSenderFallback;
  const sent = alreadyRequested || state?.ok;
  const invalid = state?.error === "invalid_email";

  return (
    <GateFrame>
      <GateTitle documentName={documentName} senderName={senderName} labels={labels} />

      <div className="mt-8 border-t border-foreground pt-4">
        <p className="flex items-center gap-2 text-body font-semibold">
          <Hourglass className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          {labels.expiredTitle}
        </p>

        {sent ? (
          <p role="status" className="mt-3 flex gap-2.5 border-l border-foreground/20 pl-3 text-body">
            <Check className="mt-1 size-4 shrink-0 text-success" strokeWidth={2.5} aria-hidden />
            <span>{labels.extensionRequested.replace("{sender}", sender)}</span>
          </p>
        ) : (
          <>
            <p className="mt-1.5 text-body text-pretty text-muted-foreground">
              {(quote ? labels.expiredTextQuote : labels.expiredText).replace("{sender}", sender)}
            </p>
            <form action={formAction} className="mt-6">
              <div className={GATE_BOX}>
                {email !== "known" && (
                  <>
                    <label htmlFor="email" className={GATE_LABEL}>
                      {email === "required" ? labels.emailLabel : labels.extensionEmailOptional}
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required={email === "required"}
                      autoComplete="email"
                      className={GATE_FIELD}
                      aria-invalid={invalid || undefined}
                      aria-describedby={invalid ? "email-error" : undefined}
                    />
                  </>
                )}
                <Button type="submit" size="xl" className={GATE_SUBMIT} disabled={pending}>
                  {labels.requestExtension}
                </Button>
              </div>
              {invalid && (
                <p id="email-error" role="alert" className="mt-2 text-small text-destructive">
                  {labels.invalidEmail}
                </p>
              )}
              {state?.error === "seller_preview" && (
                <p role="status" className="mt-2 text-small text-muted-foreground">
                  {labels.extensionSellerPreview}
                </p>
              )}
              {state?.error === "not_found" && (
                <p role="alert" className="mt-2 text-small text-destructive">
                  {labels.actionError}
                </p>
              )}
            </form>
          </>
        )}
      </div>
    </GateFrame>
  );
}
