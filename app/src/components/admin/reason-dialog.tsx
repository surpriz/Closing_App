"use client";

import { useState, useTransition, type ComponentProps, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AdminActionState } from "@/lib/admin/action-state";

import { report } from "./report";

/** An admin action that needs a reason: trigger, confirm dialog, toast. `children` adds fields. */
export function ReasonDialog({
  trigger,
  variant = "outline",
  title,
  description,
  action,
  success,
  pendingLabel,
  canSubmit = true,
  children,
}: {
  trigger: string;
  variant?: ComponentProps<typeof Button>["variant"];
  title: string;
  description: string;
  action: (formData: FormData) => Promise<AdminActionState>;
  success: string;
  pendingLabel: string;
  canSubmit?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={variant} size="sm" />}>{trigger}</DialogTrigger>
      <DialogContent>
        <form
          className="space-y-4"
          action={(formData) =>
            startTransition(async () => {
              if (report(await action(formData), success)) setOpen(false);
            })
          }
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="admin-reason">Motif</Label>
            <Textarea id="admin-reason" name="reason" required minLength={3} maxLength={500} />
          </div>
          {children}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Annuler</DialogClose>
            <Button type="submit" variant={variant === "destructive" ? "destructive" : "default"} disabled={pending || !canSubmit}>
              {pending ? pendingLabel : trigger}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
