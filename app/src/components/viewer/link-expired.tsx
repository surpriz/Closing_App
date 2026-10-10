"use client";

import { CheckCircle2, Hourglass } from "lucide-react";
import { useActionState } from "react";

import type { ExtensionState } from "@/app/v/[slug]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ViewerLabels } from "@/lib/closing/i18n/viewer";

import { GateBackdrop } from "./gate-backdrop";

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
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-16">
      <GateBackdrop />

      <div className="relative w-full max-w-sm animate-rise rounded-2xl bg-card p-6 shadow-lg ring-1 ring-border sm:p-7">
        <span className="mb-5 flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground ring-1 ring-border">
          <Hourglass className="size-4.5" aria-hidden />
        </span>
        <h1 className="text-heading">{labels.expiredTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{documentName}</span>
          {senderName && (
            <>
              {" · "}
              {labels.sharedBy} {senderName}
            </>
          )}
        </p>

        {sent ? (
          <p role="status" className="mt-5 flex gap-2.5 rounded-xl bg-muted/60 p-3.5 text-sm">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            <span>{labels.extensionRequested.replace("{sender}", sender)}</span>
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm text-muted-foreground">
              {(quote ? labels.expiredTextQuote : labels.expiredText).replace("{sender}", sender)}
            </p>
            <form action={formAction} className="mt-6 space-y-4">
              {email !== "known" && (
                <div className="space-y-2">
                  <Label htmlFor="email">{email === "required" ? labels.emailLabel : labels.extensionEmailOptional}</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required={email === "required"}
                    autoComplete="email"
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
              )}
              <Button type="submit" size="xl" className="w-full" disabled={pending}>
                {labels.requestExtension}
              </Button>
              {state?.error === "seller_preview" && (
                <p role="status" className="text-sm text-muted-foreground">
                  {labels.extensionSellerPreview}
                </p>
              )}
              {state?.error === "not_found" && (
                <p role="alert" className="text-sm text-destructive">
                  {labels.actionError}
                </p>
              )}
            </form>
          </>
        )}
      </div>
    </main>
  );
}
