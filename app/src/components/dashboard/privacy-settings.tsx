"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useTransition } from "react";
import { toast } from "sonner";

import {
  deleteAccountAction,
  deleteWorkspaceAction,
  eraseProspect,
  lookupProspect,
  type LookupState,
  type PrivacyActionState,
  type ProspectLookup,
} from "@/app/(dashboard)/settings/privacy-actions";
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
import { PRIVACY_POLICY_URL } from "@/components/viewer/privacy-notice";

function EraseProspectButton({ lookup }: { lookup: ProspectLookup }) {
  const t = useTranslations("settings.privacy");
  const [pending, startTransition] = useTransition();
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>{t("eraseTrigger")}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("eraseTitle", { email: lookup.email })}</DialogTitle>
          <DialogDescription>
            {t("eraseDescription")}
            {lookup.signatures > 0 && ` ${t("eraseSignaturesKept", { count: lookup.signatures })}`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{t("cancel")}</DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await eraseProspect(lookup.email);
                if (result?.error) toast.error(result.error);
                else toast.success(t("erased"));
              })
            }
          >
            {pending ? t("deleting") : t("erase")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProspectRequest() {
  const t = useTranslations("settings.privacy");
  const [state, formAction, pending] = useActionState<LookupState, FormData>(lookupProspect, null);
  const lookup = state?.result;
  const found = lookup && (lookup.prospects > 0 || lookup.views > 0);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <div className="space-y-3 px-5 py-4">
      <div className="space-y-1">
        <p className="text-body font-medium">{t("requestTitle")}</p>
        <p className="text-small text-muted-foreground">{t("requestDescription")}</p>
      </div>
      <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
        <Input name="email" type="email" required placeholder={t("requestPlaceholder")} aria-label={t("requestEmailLabel")} className="sm:flex-1" />
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? t("searching") : t("search")}
        </Button>
      </form>
      {lookup &&
        (found ? (
          <div className="flex flex-col gap-3 rounded-md bg-muted/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-small tabular-nums">
              {t("lookupCounts", { links: lookup.links, views: lookup.views })}
              {lookup.signatures > 0 && t("lookupSignatures", { count: lookup.signatures })}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                render={<a href={`/api/privacy/prospect?email=${encodeURIComponent(lookup.email)}`} download />}
                nativeButton={false}
              >
                {t("export")}
              </Button>
              <EraseProspectButton key={lookup.email} lookup={lookup} />
            </div>
          </div>
        ) : (
          <p className="text-small text-muted-foreground">{t("nothingFound", { email: lookup.email })}</p>
        ))}
    </div>
  );
}

function ConfirmedDelete({
  title,
  description,
  trigger,
  confirmLabel,
  confirmValue,
  action,
}: {
  title: string;
  description: string;
  trigger: string;
  confirmLabel: string;
  confirmValue: string;
  action: (prev: PrivacyActionState, formData: FormData) => Promise<PrivacyActionState>;
}) {
  const t = useTranslations("settings.privacy");
  const [state, formAction, pending] = useActionState<PrivacyActionState, FormData>(action, null);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="sm" className="text-destructive" />}>{trigger}</DialogTrigger>
      <DialogContent>
        <form action={formAction} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <label className="block space-y-1.5 text-small">
            <span>
              {confirmLabel} <strong>{confirmValue}</strong>
            </span>
            <Input name="confirm" required autoComplete="off" />
          </label>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>{t("cancel")}</DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? t("deleting") : t("deleteForGood")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Row({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-0.5">
        <p className="text-body font-medium">{title}</p>
        <p className="text-small text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function PrivacySettings({
  workspaceName,
  isManager,
  isOwner,
}: {
  workspaceName: string;
  isManager: boolean;
  isOwner: boolean;
}) {
  const t = useTranslations("settings.privacy");
  return (
    <section id="donnees" className="scroll-mt-24 space-y-3">
      <div className="space-y-1">
        <h2 className="text-heading">{t("title")}</h2>
        <p className="text-body text-muted-foreground">
          {t("description")}{" "}
          <a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer" className="underline">
            {t("policy")}
          </a>
        </p>
      </div>
      <div className="divide-y divide-border border-y border-foreground bg-card">
        {isManager && <ProspectRequest />}
        {isManager && (
          <Row title={t("exportWorkspaceTitle")} description={t("exportWorkspaceDescription")}>
            <Button variant="outline" size="sm" render={<a href="/api/privacy/workspace" download />} nativeButton={false}>
              {t("download")}
            </Button>
          </Row>
        )}
        <Row title={t("deleteAccountTitle")} description={t("deleteAccountDescription")}>
          <ConfirmedDelete
            title={t("deleteAccountDialogTitle")}
            description={t("deleteAccountDialogDescription")}
            trigger={t("deleteTrigger")}
            confirmLabel={t("deleteAccountConfirmLabel")}
            confirmValue={t("deleteAccountConfirmWord")}
            action={deleteAccountAction}
          />
        </Row>
        {isOwner && (
          <Row title={t("deleteWorkspaceTitle")} description={t("deleteWorkspaceDescription")}>
            <ConfirmedDelete
              title={t("deleteWorkspaceDialogTitle", { workspace: workspaceName })}
              description={t("deleteWorkspaceDialogDescription")}
              trigger={t("deleteTrigger")}
              confirmLabel={t("deleteWorkspaceConfirmLabel")}
              confirmValue={workspaceName}
              action={deleteWorkspaceAction}
            />
          </Row>
        )}
      </div>
    </section>
  );
}
