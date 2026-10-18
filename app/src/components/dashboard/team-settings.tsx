"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useEffect, useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import {
  cancelInvitation,
  inviteMember,
  removeMember,
  updateMemberRole,
  type TeamActionState,
} from "@/app/(dashboard)/settings/team-actions";
import { openUpgrade } from "@/components/billing/upgrade-dialog";
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
import { INTL_LOCALE } from "@/i18n/locale";

import { CopyButton } from "./copy-button";
import { roleLabel } from "./labels";

export type TeamMemberRow = { id: string; userId: string; name: string; email: string; role: string };
export type TeamInvitationRow = { id: string; email: string; role: string; expiresAt: string };

function report(result: TeamActionState, success: string) {
  if (result?.error) toast.error(result.error);
  else toast.success(success);
}

function RoleSelect({ member, roles }: { member: TeamMemberRow; roles: string[] }) {
  const t = useTranslations("team.settings");
  const tl = useTranslations("labels");
  const [optimistic, setOptimistic] = useOptimistic(member.role);
  const [pending, startTransition] = useTransition();
  const items = roles.map((value) => ({ value, label: roleLabel(tl, value) }));

  return (
    <Select
      items={items}
      value={optimistic}
      disabled={pending}
      onValueChange={(value) => {
        if (!value || value === member.role) return;
        startTransition(async () => {
          setOptimistic(value);
          report(
            await updateMemberRole(member.id, value),
            t("roleChanged", { name: member.name, role: roleLabel(tl, value).toLowerCase() }),
          );
        });
      }}
    >
      <SelectTrigger aria-label={t("roleAria", { name: member.name })} size="sm" className="min-w-32 bg-card">
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
  const t = useTranslations("team.settings");
  const [pending, startTransition] = useTransition();

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>{t("remove")}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("removeTitle", { name: member.name })}</DialogTitle>
          <DialogDescription>{t("removeDescription")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{t("cancel")}</DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => report(await removeMember(member.id), t("removed", { name: member.name })))
            }
          >
            {pending ? t("removing") : t("remove")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelInvitationButton({ id }: { id: string }) {
  const t = useTranslations("team.settings");
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(async () => report(await cancelInvitation(id), t("invitationCancelled")))}
    >
      {t("cancel")}
    </Button>
  );
}

function InviteForm() {
  const t = useTranslations("team.settings");
  const tl = useTranslations("labels");
  const [state, formAction, pending] = useActionState<TeamActionState, FormData>(inviteMember, null);

  useEffect(() => {
    if (state?.ok) toast.success(t("invitationSent"));
    if (state?.upgrade && state.error) openUpgrade({ error: state.error, upgrade: state.upgrade });
    else if (state?.error) toast.error(state.error);
  }, [state, t]);

  return (
    <form action={formAction} className="space-y-3 px-5 py-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input name="email" type="email" required placeholder={t("emailPlaceholder")} aria-label={t("emailAria")} className="sm:flex-1" />
        <select
          name="role"
          defaultValue="member"
          aria-label={t("roleSelectAria")}
          className="h-9 rounded-lg border border-input bg-card px-2 text-small outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
        >
          <option value="member">{tl("role.member")}</option>
          <option value="admin">{tl("role.admin")}</option>
        </select>
        <Button type="submit" disabled={pending}>
          {pending ? t("sending") : t("invite")}
        </Button>
      </div>
      {state?.devUrl && (
        <p className="flex items-center gap-1 text-small text-muted-foreground">
          {t("devLink")}
          <span className="truncate font-mono text-micro text-foreground">{state.devUrl}</span>
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
  const t = useTranslations("team.settings");
  const tl = useTranslations("labels");
  const locale = useLocale();
  const dateFormat = new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "numeric", month: "short" });
  // Only an owner hands out "owner"; an admin cannot touch an owner
  const roles = viewer.isOwner ? ["member", "admin", "owner"] : ["member", "admin"];
  const canManage = (member: TeamMemberRow) =>
    member.userId !== viewer.userId && (viewer.isOwner || member.role !== "owner");

  return (
    <section id="equipe" className="scroll-mt-24 space-y-3">
      <div className="space-y-1">
        <h2 className="text-heading">{t("title")}</h2>
        <p className="text-body text-muted-foreground">{t("intro")}</p>
      </div>
      <div className="divide-y divide-border border-y border-foreground bg-card">
        {members.map((member) => (
          <div key={member.id} className="flex items-center justify-between gap-4 px-5 py-3">
            <div className="min-w-0">
              <p className="truncate text-body">
                {member.name}
                {member.userId === viewer.userId && <span className="text-muted-foreground"> {t("you")}</span>}
              </p>
              <p className="truncate text-small text-muted-foreground">{member.email}</p>
            </div>
            {canManage(member) ? (
              <div className="flex shrink-0 items-center gap-1">
                <RoleSelect member={member} roles={roles} />
                <RemoveButton member={member} />
              </div>
            ) : (
              <span className="shrink-0 text-small text-muted-foreground">{roleLabel(tl, member.role)}</span>
            )}
          </div>
        ))}
        {invitations.map((invitation) => (
          <div key={invitation.id} className="flex items-center justify-between gap-4 px-5 py-3">
            <div className="min-w-0">
              <p className="truncate text-body">{invitation.email}</p>
              <p className="text-small text-muted-foreground">
                {t("invited", {
                  role: roleLabel(tl, invitation.role).toLowerCase(),
                  date: dateFormat.format(new Date(invitation.expiresAt)),
                })}
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
