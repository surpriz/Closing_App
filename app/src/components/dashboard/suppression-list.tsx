"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  addSuppressionAction,
  removeSuppressionAction,
  type SuppressionFormState,
} from "@/app/(dashboard)/settings/suppression-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { INTL_LOCALE, type UiLocale } from "@/i18n/locale";

export type SuppressionRow = {
  id: string;
  email: string;
  reason: "UNSUBSCRIBE" | "BOUNCE" | "COMPLAINT" | "MANUAL";
  source: string;
  createdAt: string;
};

function RemoveButton({ id, email }: { id: string; email: string }) {
  const t = useTranslations("settings.suppressions");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {t("remove")}
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("removeTitle")}</DialogTitle>
          <DialogDescription>{t("removeDescription", { email })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            {t("cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await removeSuppressionAction(id);
                if ("error" in result) toast.error(result.error);
                else toast.success(t("removed"));
                setOpen(false);
              })
            }
          >
            {pending ? t("removing") : t("remove")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SuppressionList({
  rows,
  total,
  canRemove,
}: {
  rows: SuppressionRow[];
  total: number;
  canRemove: boolean;
}) {
  const t = useTranslations("settings.suppressions");
  const locale = useLocale() as UiLocale;
  const format = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  // Remounts the form once an address went in, which empties the field
  const [version, setVersion] = useState(0);
  const [state, formAction, pending] = useActionState<SuppressionFormState, FormData>(async (prev, formData) => {
    const result = await addSuppressionAction(prev, formData);
    if (result && "ok" in result) {
      setVersion((v) => v + 1);
      toast.success(t("added"));
    }
    return result;
  }, null);

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-heading">{t("title")}</h2>
        <p className="text-body text-muted-foreground">{t("description")}</p>
      </div>

      <div className="border border-border">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 text-small">
          <span>{t("count", { count: total })}</span>
          {total > 0 && (
            <a href="/api/outreach/suppressions" className={buttonVariants({ variant: "outline", size: "sm" })}>
              {t("export")}
            </a>
          )}
        </div>
        {rows.length === 0 ? (
          <p className="px-5 py-3 text-small text-muted-foreground">{t("empty")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.email")}</TableHead>
                <TableHead>{t("columns.reason")}</TableHead>
                <TableHead>{t("columns.source")}</TableHead>
                <TableHead>{t("columns.date")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="break-all">{row.email}</TableCell>
                  <TableCell>{t(`reason.${row.reason}`)}</TableCell>
                  <TableCell>{row.source}</TableCell>
                  <TableCell>{format.format(new Date(row.createdAt))}</TableCell>
                  <TableCell className="text-right">
                    {canRemove && row.reason === "MANUAL" && <RemoveButton id={row.id} email={row.email} />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {total > rows.length && (
          <p className="border-t border-border px-5 py-3 text-small text-muted-foreground">
            {t("latest", { count: rows.length })}
          </p>
        )}
      </div>

      <form key={version} action={formAction} className="flex flex-wrap items-start gap-2">
        <Input
          name="email"
          type="email"
          required
          maxLength={254}
          placeholder={t("placeholder")}
          aria-label={t("addLabel")}
          className="max-w-xs"
        />
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? t("adding") : t("add")}
        </Button>
        {state && "error" in state && (
          <p role="alert" className="basis-full text-small text-destructive">
            {state.error}
          </p>
        )}
      </form>
    </section>
  );
}
