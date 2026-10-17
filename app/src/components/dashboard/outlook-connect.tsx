"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { claimOutlookPairing } from "@/app/extension/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OutlookConnect({
  account,
  doneHint,
}: {
  account: { email: string; workspace: string };
  /** Replaces the "back to Outlook, close this tab" line once connected. */
  doneHint?: React.ReactNode;
}) {
  const t = useTranslations("settings.outlookConnect");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await claimOutlookPairing(code);
      if (result.ok) setDone(true);
      else setError(result.message);
    });
  }

  if (done) {
    return (
      <div className="space-y-4 rounded-xl bg-card p-6 ring-1 ring-foreground/85">
        <p className="flex items-center gap-2 text-heading">
          <Check className="size-4 text-success" aria-hidden />
          {t("doneTitle")}
        </p>
        <p className="text-body text-muted-foreground">
          {doneHint ?? t("doneHint")}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl bg-card p-6 ring-1 ring-foreground/85">
      <p className="text-body">
        {t.rich("account", {
          workspace: account.workspace,
          email: account.email,
          b: (chunks) => <strong>{chunks}</strong>,
        })}
      </p>
      <div className="space-y-2">
        <Label htmlFor="outlook-code">{t("codeLabel")}</Label>
        <Input
          id="outlook-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="XXXX-XXXX"
          autoComplete="off"
          spellCheck={false}
          className="font-mono tracking-widest uppercase"
          autoFocus
        />
        <p className="text-small text-muted-foreground">
          {t("codeHint")}
        </p>
      </div>
      {error && (
        <p role="alert" className="text-small text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending || !code.trim()}>
        {pending ? t("connecting") : t("connect")}
      </Button>
    </form>
  );
}
