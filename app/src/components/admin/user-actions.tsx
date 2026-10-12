"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  banUser,
  disableUser,
  impersonateUser,
  reactivateUser,
  revokeUserSessions,
  type AdminActionState,
} from "@/app/admin/user-actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { UserStatus } from "@/lib/platform-admin";

export function report(result: AdminActionState, success: string) {
  if (result?.error) toast.error(result.error);
  else toast.success(success);
  return !result?.error;
}

function DisableDialog({ userId, email }: { userId: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Désactiver</DialogTrigger>
      <DialogContent>
        <form
          className="space-y-4"
          action={(formData) =>
            startTransition(async () => {
              if (report(await disableUser(userId, formData), `${email} est désactivé`)) setOpen(false);
            })
          }
        >
          <DialogHeader>
            <DialogTitle>Désactiver {email} ?</DialogTitle>
            <DialogDescription>
              Ses sessions et son extension sont coupées tout de suite. Ses données restent, vous pouvez le réactiver
              quand vous voulez.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="disable-reason">Motif</Label>
            <Textarea id="disable-reason" name="reason" required minLength={3} maxLength={500} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="disable-duration">Durée</Label>
            <select
              id="disable-duration"
              name="duration"
              defaultValue="none"
              className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
            >
              <option value="1">1 jour</option>
              <option value="7">7 jours</option>
              <option value="30">30 jours</option>
              <option value="none">Jusqu&apos;à réactivation</option>
            </select>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Annuler</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Désactivation…" : "Désactiver"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BanDialog({ userId, email }: { userId: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>Bannir</DialogTrigger>
      <DialogContent>
        <form
          className="space-y-4"
          action={(formData) =>
            startTransition(async () => {
              if (report(await banUser(userId, formData), `${email} est banni`)) setOpen(false);
            })
          }
        >
          <DialogHeader>
            <DialogTitle>Bannir {email} ?</DialogTitle>
            <DialogDescription>
              Accès coupé, extension déconnectée, et cet email ne pourra plus créer de compte. Réversible depuis cette
              page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ban-reason">Motif</Label>
            <Textarea id="ban-reason" name="reason" required minLength={3} maxLength={500} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ban-confirm">Tapez {email} pour confirmer</Label>
            <Input
              id="ban-confirm"
              name="confirm"
              autoComplete="off"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Annuler</DialogClose>
            <Button
              type="submit"
              variant="destructive"
              disabled={pending || confirm.trim().toLowerCase() !== email.toLowerCase()}
            >
              {pending ? "Bannissement…" : "Bannir"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UserActions({ userId, email, status }: { userId: string; email: string; status: UserStatus }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      {status === "active" && <DisableDialog userId={userId} email={email} />}
      {status !== "banned" && <BanDialog userId={userId} email={email} />}
      {status !== "active" && (
        <Button
          size="sm"
          disabled={pending}
          onClick={() => startTransition(async () => void report(await reactivateUser(userId), `${email} est réactivé`))}
        >
          Réactiver
        </Button>
      )}
      {status === "active" && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              // Redirects to the app on success
              const result = await impersonateUser(userId);
              if (result?.error) toast.error(result.error);
            })
          }
        >
          Se connecter en tant que
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => void report(await revokeUserSessions(userId), "Déconnecté de tous ses appareils"))
        }
      >
        Déconnecter partout
      </Button>
    </div>
  );
}
