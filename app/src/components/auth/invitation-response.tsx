"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

type Result = { error?: string };

/** Join or decline buttons, and the error Better Auth sent back if any. */
export function InvitationResponse({
  accept,
  reject,
}: {
  accept: () => Promise<Result>;
  reject: () => Promise<Result>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (action: () => Promise<Result>) =>
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (result?.error) setError(result.error);
    });

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button disabled={pending} onClick={() => run(accept)}>
          Rejoindre l&apos;équipe
        </Button>
        <Button variant="ghost" disabled={pending} onClick={() => run(reject)}>
          Refuser
        </Button>
      </div>
      {error && <p className="text-destructive">{error}</p>}
    </div>
  );
}

/** Signed in with the wrong address: sign out, then back to the invitation. */
export function SwitchAccountButton({ next }: { next: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await authClient.signOut();
          router.push(`/login?next=${encodeURIComponent(next)}`);
          router.refresh();
        })
      }
    >
      Changer de compte
    </Button>
  );
}
