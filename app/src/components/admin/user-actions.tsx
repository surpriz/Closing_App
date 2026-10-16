"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  banUser,
  disableUser,
  impersonateUser,
  reactivateUser,
  revokeUserSessions,
} from "@/app/admin/user-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeEmail, type UserStatus } from "@/lib/platform-admin";

import { DeleteUsersDialog } from "./delete-users";
import { ReasonDialog } from "./reason-dialog";
import { report } from "./report";
import { ADMIN_SELECT } from "./styles";

function BanDialog({ userId, email }: { userId: string; email: string }) {
  const [confirm, setConfirm] = useState("");

  return (
    <ReasonDialog
      trigger="Bannir"
      variant="destructive"
      title={`Bannir ${email} ?`}
      description="Accès coupé, extension déconnectée, et cet email ne pourra plus créer de compte. Réversible depuis cette page."
      action={(formData) => banUser(userId, formData)}
      success={`${email} est banni`}
      pendingLabel="Bannissement…"
      canSubmit={normalizeEmail(confirm) === normalizeEmail(email)}
    >
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
    </ReasonDialog>
  );
}

export function UserActions({ userId, email, status }: { userId: string; email: string; status: UserStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      {status === "active" && (
        <ReasonDialog
          trigger="Désactiver"
          title={`Désactiver ${email} ?`}
          description="Ses sessions et son extension sont coupées tout de suite. Ses données restent, vous pouvez le réactiver quand vous voulez."
          action={(formData) => disableUser(userId, formData)}
          success={`${email} est désactivé`}
          pendingLabel="Désactivation…"
        >
          <div className="space-y-2">
            <Label htmlFor="disable-duration">Durée</Label>
            <select id="disable-duration" name="duration" defaultValue="none" className={`${ADMIN_SELECT} w-full`}>
              <option value="1">1 jour</option>
              <option value="7">7 jours</option>
              <option value="30">30 jours</option>
              <option value="none">Jusqu&apos;à réactivation</option>
            </select>
          </div>
        </ReasonDialog>
      )}
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
          // Redirects to the app on success
          onClick={() => startTransition(async () => void report(await impersonateUser(userId)))}
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
      <DeleteUsersDialog users={[{ id: userId, email }]} onDeleted={() => router.push("/admin/users")} />
    </div>
  );
}
