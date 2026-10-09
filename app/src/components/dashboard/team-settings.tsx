"use client";

import { useActionState, useEffect, useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import {
  cancelInvitation,
  inviteMember,
  removeMember,
  updateMemberRole,
  type TeamActionState,
} from "@/app/(dashboard)/settings/team-actions";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { CopyButton } from "./copy-button";
import { ROLE_LABELS } from "./labels";

export type TeamMemberRow = { id: string; userId: string; name: string; email: string; role: string };
export type TeamInvitationRow = { id: string; email: string; role: string; expiresAt: string };

const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

const roleLabel = (role: string) => ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role;

function report(result: TeamActionState, success: string) {
  if (result?.error) toast.error(result.error);
  else toast.success(success);
}

function RoleSelect({ member, roles }: { member: TeamMemberRow; roles: string[] }) {
  const [optimistic, setOptimistic] = useOptimistic(member.role);
  const [pending, startTransition] = useTransition();
  const items = roles.map((value) => ({ value, label: roleLabel(value) }));

  return (
    <Select
      items={items}
      value={optimistic}
      disabled={pending}
      onValueChange={(value) => {
        if (!value || value === member.role) return;
        startTransition(async () => {
          setOptimistic(value);
          report(await updateMemberRole(member.id, value), `${member.name} est maintenant ${roleLabel(value).toLowerCase()}`);
        });
      }}
    >
      <SelectTrigger aria-label={`Rôle de ${member.name}`} size="sm" className="min-w-32 bg-card">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RemoveButton({ member }: { member: TeamMemberRow }) {
  const [pending, startTransition] = useTransition();

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>Retirer</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Retirer {member.name} de l&apos;équipe ?</DialogTitle>
          <DialogDescription>
            Ses deals restent dans l&apos;espace et passent au propriétaire. Son extension Chrome est déconnectée.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => report(await removeMember(member.id), `${member.name} a été retiré`))
            }
          >
            {pending ? "Retrait…" : "Retirer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelInvitationButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(async () => report(await cancelInvitation(id), "Invitation annulée"))}
    >
      Annuler
    </Button>
  );
}

function InviteForm() {
  const [state, formAction, pending] = useActionState<TeamActionState, FormData>(inviteMember, null);

  useEffect(() => {
    if (state?.ok) toast.success("Invitation envoyée");
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-3 px-5 py-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input name="email" type="email" required placeholder="prenom@entreprise.fr" aria-label="Email" className="sm:flex-1" />
        <select
          name="role"
          defaultValue="member"
          aria-label="Rôle"
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
        >
          <option value="member">{ROLE_LABELS.member}</option>
          <option value="admin">{ROLE_LABELS.admin}</option>
        </select>
        <Button type="submit" disabled={pending}>
          {pending ? "Envoi…" : "Inviter"}
        </Button>
      </div>
      {state?.devUrl && (
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          Pas d&apos;email en local, lien à ouvrir :
          <span className="truncate font-mono text-foreground">{state.devUrl}</span>
          <CopyButton value={state.devUrl} />
        </p>
      )}
    </form>
  );
}

export function TeamSettings({
  viewer,
  members,
  invitations,
}: {
  viewer: { userId: string; isOwner: boolean };
  members: TeamMemberRow[];
  invitations: TeamInvitationRow[];
}) {
  // Only an owner hands out "owner"; an admin cannot touch an owner
  const roles = viewer.isOwner ? ["member", "admin", "owner"] : ["member", "admin"];
  const canManage = (member: TeamMemberRow) =>
    member.userId !== viewer.userId && (viewer.isOwner || member.role !== "owner");

  return (
    <section id="equipe" className="scroll-mt-24 space-y-3">
      <div className="space-y-1">
        <h2 className="text-heading">Équipe</h2>
        <p className="text-body text-muted-foreground">
          Chaque commercial suit ses propres deals. Les admins voient toute l&apos;équipe sur la page Équipe et règlent
          l&apos;espace.
        </p>
      </div>
      <div className="divide-y divide-border rounded-xl bg-card shadow-xs ring-1 ring-border">
        {members.map((member) => (
          <div key={member.id} className="flex items-center justify-between gap-4 px-5 py-3">
            <div className="min-w-0">
              <p className="truncate text-body">
                {member.name}
                {member.userId === viewer.userId && <span className="text-muted-foreground"> (vous)</span>}
              </p>
              <p className="truncate text-small text-muted-foreground">{member.email}</p>
            </div>
            {canManage(member) ? (
              <div className="flex shrink-0 items-center gap-1">
                <RoleSelect member={member} roles={roles} />
                <RemoveButton member={member} />
              </div>
            ) : (
              <span className="shrink-0 text-sm text-muted-foreground">{roleLabel(member.role)}</span>
            )}
          </div>
        ))}
        {invitations.map((invitation) => (
          <div key={invitation.id} className="flex items-center justify-between gap-4 px-5 py-3">
            <div className="min-w-0">
              <p className="truncate text-body">{invitation.email}</p>
              <p className="text-small text-muted-foreground">
                Invité comme {roleLabel(invitation.role).toLowerCase()}, en attente jusqu&apos;au{" "}
                {dateFormat.format(new Date(invitation.expiresAt))}
              </p>
            </div>
            <CancelInvitationButton id={invitation.id} />
          </div>
        ))}
        <InviteForm />
      </div>
    </section>
  );
}
