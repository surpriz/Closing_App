"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";

import {
  allowEmail,
  blockEmail,
  disallowEmail,
  setSignupMode,
  unblockEmail,
} from "@/app/admin/settings-actions";
import type { AdminActionState } from "@/app/admin/user-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SignupMode } from "@/lib/platform-admin";

import { report } from "./user-actions";

export function SignupModeForm({ mode }: { mode: SignupMode }) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-wrap items-center gap-2 px-5 py-4"
      action={(formData) => startTransition(async () => void report(await setSignupMode(formData), "Mode enregistré"))}
    >
      <select
        name="mode"
        defaultValue={mode}
        aria-label="Mode d'inscription"
        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
      >
        <option value="open">Ouvertes à tous</option>
        <option value="invite_only">Sur invitation ou liste autorisée</option>
      </select>
      <Button type="submit" variant="outline" disabled={pending}>
        Enregistrer
      </Button>
    </form>
  );
}

function AddEmailForm({
  action,
  placeholder,
  withReason = false,
  success,
}: {
  action: (prev: AdminActionState, formData: FormData) => Promise<AdminActionState>;
  placeholder: string;
  withReason?: boolean;
  success: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) {
      toast.success(success);
      form.current?.reset();
    }
  }, [state, success]);

  return (
    <form ref={form} action={formAction} className="flex flex-col gap-2 px-5 py-4 sm:flex-row">
      <Input name="email" type="email" required placeholder={placeholder} aria-label="Email" className="sm:flex-1" />
      {withReason && <Input name="reason" placeholder="Motif (optionnel)" aria-label="Motif" className="sm:flex-1" />}
      <Button type="submit" disabled={pending}>
        Ajouter
      </Button>
    </form>
  );
}

function RemoveButton({ onRemove, success }: { onRemove: () => Promise<AdminActionState>; success: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(async () => void report(await onRemove(), success))}
    >
      Retirer
    </Button>
  );
}

export function EmailList({
  kind,
  rows,
}: {
  kind: "allowed" | "blocked";
  rows: { email: string; detail?: string | null }[];
}) {
  const blocked = kind === "blocked";

  return (
    <div className="divide-y divide-border">
      {rows.map((row) => (
        <div key={row.email} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
          <div className="min-w-0">
            <p className="truncate">{row.email}</p>
            {row.detail && <p className="truncate text-small text-muted-foreground">{row.detail}</p>}
          </div>
          <RemoveButton
            onRemove={() => (blocked ? unblockEmail(row.email) : disallowEmail(row.email))}
            success={`${row.email} retiré`}
          />
        </div>
      ))}
      <AddEmailForm
        action={blocked ? blockEmail : allowEmail}
        placeholder="prenom@entreprise.fr"
        withReason={blocked}
        success={blocked ? "Email bloqué" : "Email autorisé"}
      />
    </div>
  );
}
