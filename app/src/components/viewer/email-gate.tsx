"use client";

import { useActionState } from "react";

import type { UnlockState } from "@/app/v/[slug]/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ViewerLabels } from "@/lib/closing/i18n/viewer";

type Props = {
  action: (prev: UnlockState, formData: FormData) => Promise<UnlockState>;
  documentName: string;
  labels: ViewerLabels;
};

export function EmailGate({ action, documentName, labels }: Props) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">{labels.emailTitle}</CardTitle>
          <CardDescription>
            <span className="font-medium text-foreground">{documentName}</span>
            <br />
            {labels.emailDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{labels.emailLabel}</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">{labels.nameLabel}</Label>
              <Input id="name" name="name" autoComplete="name" />
            </div>
            {state?.error === "invalid_email" && (
              <p className="text-sm text-destructive">{labels.invalidEmail}</p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {labels.emailSubmit}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
