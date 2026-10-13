"use client";

import { Check } from "lucide-react";
import { useActionState } from "react";

import type { UnsubscribeState } from "@/app/u/[token]/actions";
import { Button } from "@/components/ui/button";
import type { UnsubscribeCopy } from "@/lib/closing/unsubscribe/copy";

type Props = {
  action: () => Promise<UnsubscribeState>;
  email: string;
  alreadyDone: boolean;
  copy: UnsubscribeCopy;
};

export function UnsubscribeForm({ action, email, alreadyDone, copy }: Props) {
  const [state, formAction, pending] = useActionState(action, alreadyDone ? { done: true } : null);

  if (state?.done) {
    return (
      <p role="status" className="flex gap-2.5">
        <Check className="mt-1 size-4 shrink-0 text-success" strokeWidth={2.5} aria-hidden />
        <span>{copy.pageDone}</span>
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <p className="text-pretty text-muted-foreground">
        {copy.pageDescription} <span className="font-medium break-all text-foreground">{email}</span>.
      </p>
      {state?.error && (
        <p role="alert" className="text-small text-destructive">
          {copy.pageInvalid}
        </p>
      )}
      <Button type="submit" size="xl" className="w-full text-body" disabled={pending}>
        {copy.pageButton}
      </Button>
    </form>
  );
}
