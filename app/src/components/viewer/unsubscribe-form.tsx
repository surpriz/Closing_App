"use client";

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

  if (state?.done) return <p className="text-muted-foreground">{copy.pageDone}</p>;

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-muted-foreground">
        {copy.pageDescription} <span className="font-medium text-foreground">{email}</span>.
      </p>
      {state?.error && <p className="text-destructive">{copy.pageInvalid}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {copy.pageButton}
      </Button>
    </form>
  );
}
