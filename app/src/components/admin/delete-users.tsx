"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";

import { deleteUsers } from "@/app/admin/user-actions";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { plural } from "@/lib/admin/format";

import { ReasonDialog } from "./reason-dialog";

type Picked = { id: string; email: string };

/** Accounts, their empty workspaces and their documents, gone for good. */
export function DeleteUsersDialog({ users, onDeleted }: { users: Picked[]; onDeleted?: () => void }) {
  const [confirm, setConfirm] = useState("");
  const many = users.length > 1;
  const who = many ? `${users.length} comptes` : users[0]?.email;

  return (
    <ReasonDialog
      trigger={many ? `Supprimer ${users.length} comptes` : "Supprimer"}
      variant="destructive"
      title={`Supprimer ${who} ?`}
      description="Définitif. Les comptes partent avec leurs documents, leurs liens et les fichiers stockés. Un espace où ils étaient seuls est supprimé en entier ; dans une équipe, seuls leurs documents disparaissent."
      action={async (formData) => {
        const result = await deleteUsers(
          users.map((user) => user.id),
          formData,
        );
        if (result?.ok) onDeleted?.();
        return result;
      }}
      success={many ? `${users.length} comptes supprimés` : `${who} est supprimé`}
      pendingLabel="Suppression…"
      canSubmit={confirm.trim().toUpperCase() === "SUPPRIMER"}
    >
      {many && (
        <p className="max-h-32 overflow-y-auto text-small text-muted-foreground">
          {users.map((user) => user.email).join(", ")}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="delete-confirm">Tapez SUPPRIMER pour confirmer</Label>
        <Input
          id="delete-confirm"
          name="confirm"
          autoComplete="off"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </div>
    </ReasonDialog>
  );
}

const Selection = createContext<{
  picked: Picked[];
  toggle: (user: Picked, on: boolean) => void;
  clear: () => void;
} | null>(null);

function useSelection() {
  const context = useContext(Selection);
  if (!context) throw new Error("useSelection outside UserSelection");
  return context;
}

/** Ticks on the users list, for deleting several accounts at once. */
export function UserSelection({ children }: { children: ReactNode }) {
  const [picked, setPicked] = useState<Picked[]>([]);
  const toggle = (user: Picked, on: boolean) =>
    setPicked((current) => (on ? [...current.filter((p) => p.id !== user.id), user] : current.filter((p) => p.id !== user.id)));
  return <Selection value={{ picked, toggle, clear: () => setPicked([]) }}>{children}</Selection>;
}

export function UserCheckbox({ user }: { user: Picked }) {
  const { picked, toggle } = useSelection();
  return (
    <Checkbox
      // Above the row's link, which covers the whole row
      className="z-10"
      aria-label={`Sélectionner ${user.email}`}
      checked={picked.some((p) => p.id === user.id)}
      onCheckedChange={(on) => toggle(user, on)}
    />
  );
}

export function SelectionBar() {
  const router = useRouter();
  const { picked, clear } = useSelection();
  if (picked.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 text-small">
      <span>
        {picked.length} {plural(picked.length, "compte")} {plural(picked.length, "sélectionné")}
      </span>
      <DeleteUsersDialog
        users={picked}
        onDeleted={() => {
          clear();
          router.refresh();
        }}
      />
      <button type="button" onClick={clear} className="text-muted-foreground hover:text-foreground">
        Tout désélectionner
      </button>
    </div>
  );
}
