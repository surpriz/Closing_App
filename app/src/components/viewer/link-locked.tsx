"use client";

import { Archive, Check, Hourglass } from "lucide-react";
import { useActionState } from "react";

import type { RevivalState } from "@/app/v/[slug]/actions";
import { Button } from "@/components/ui/button";
import type { ViewerLabels } from "@/lib/closing/i18n/viewer";

import { DeadLinkBeacon } from "./dead-link-beacon";
import { GATE_BOX, GATE_FIELD, GATE_LABEL, GATE_SUBMIT, GateFrame, GateTitle } from "./gate-frame";

type Props = {
  action: (prev: RevivalState, formData: FormData) => Promise<RevivalState>;
  /** Expired: more time can open it. Archived: the seller withdrew it, they can send it again. */
  reason: "expired" | "archived";
  slug: string;
  documentName: string;
  senderName: string | null;
  labels: ViewerLabels;
  /** Quotes and proposals: "the price is no longer guaranteed" rather than "the link is off". */
  quote: boolean;
  /** "required" when the link asks for an email and we don't know the reader yet. */
  email: "required" | "optional" | "known";
  /** This reader already asked since the link died. */
  alreadyRequested: boolean;
  /** Tell the seller someone came back. Off for the seller, and when the countdown just ran out mid-read. */
  signalOpen: boolean;
};

export function LinkLocked({
  action,
  reason,
  slug,
  documentName,
  senderName,
  labels,
  quote,
  email,
  alreadyRequested,
  signalOpen,
}: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const sender = senderName ?? labels.chatSenderFallback;
  const sent = alreadyRequested || !!state?.ok;
  const invalid = state?.error === "invalid_email";
  const archived = reason === "archived";
  const Icon = archived ? Archive : Hourglass;
  const text = archived ? labels.archivedText : quote ? labels.expiredTextQuote : labels.expiredText;

  return (
    <GateFrame>
      {signalOpen && !alreadyRequested && <DeadLinkBeacon slug={slug} disarmed={sent} />}
      <GateTitle documentName={documentName} senderName={senderName} labels={labels} />

      <div className="mt-8 border-t border-foreground pt-4">
        <p className="flex items-center gap-2 text-body font-semibold">
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          {archived ? labels.archivedTitle : labels.expiredTitle}
        </p>

        {sent ? (
          <p role="status" className="mt-3 flex gap-2.5 border-l border-foreground/20 pl-3 text-body">
            <Check className="mt-1 size-4 shrink-0 text-success" strokeWidth={2.5} aria-hidden />
            <span>{(archived ? labels.relinkRequested : labels.extensionRequested).replace("{sender}", sender)}</span>
          </p>
        ) : (
          <>
            <p className="mt-1.5 text-body text-pretty text-muted-foreground">{text.replace("{sender}", sender)}</p>
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
                  {archived ? labels.requestRelink : labels.requestExtension}
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
