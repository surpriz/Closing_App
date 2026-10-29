"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

import { addForwardedContactAction } from "@/app/(dashboard)/campaigns/actions";
import { Surface } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { UiLocale } from "@/i18n/locale";
import { formatDate } from "@/lib/format";

export type ForwardedContact = {
  prospectId: string;
  email: string;
  name: string | null;
  company: string | null;
  forwardedAt: Date;
};

/** People a prospect forwarded the document to. Nothing is sent to them until the seller adds them (E8). */
export function ForwardedContacts({
  campaignId,
  contacts,
  locale,
}: {
  campaignId: string;
  contacts: ForwardedContact[];
  locale: UiLocale;
}) {
  const t = useTranslations("campaigns.forwarded");
  const [pending, startTransition] = useTransition();

  if (contacts.length === 0) return null;

  const add = (prospectId: string) =>
    startTransition(async () => {
      const result = await addForwardedContactAction(campaignId, prospectId);
      if ("error" in result) toast.error(result.error);
      else if (result.notice) toast.success(result.notice);
    });

  return (
    <div className="space-y-3">
      <p className="text-small text-muted-foreground">{t("description")}</p>
      <Surface>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("email")}</TableHead>
              <TableHead>{t("forwardedAt")}</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">{t("add")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow key={contact.prospectId}>
                <TableCell className="max-w-64">
                  <p className="truncate font-medium">{contact.email}</p>
                  {(contact.name || contact.company) && (
                    <p className="truncate text-small text-muted-foreground">
                      {[contact.name, contact.company].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(contact.forwardedAt, locale)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => add(contact.prospectId)}>
                    {t("add")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Surface>
    </div>
  );
}
