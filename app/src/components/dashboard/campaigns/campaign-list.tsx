import Link from "next/link";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { UiLocale } from "@/i18n/locale";
import { formatRelative } from "@/lib/format";

export type CampaignRow = {
  id: string;
  name: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "DONE" | "ARCHIVED";
  mailbox: string | null;
  enrolled: number;
  sent: number;
  replied: number;
  bounced: number;
  updatedAt: Date;
};

const STATUS_VARIANT = {
  DRAFT: "secondary",
  ACTIVE: "success",
  PAUSED: "warning",
  DONE: "info",
  ARCHIVED: "secondary",
} as const;

export function CampaignList({ rows, locale, now }: { rows: CampaignRow[]; locale: UiLocale; now: Date }) {
  const t = useTranslations("campaigns");
  const num = "text-right tabular-nums";

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("page.columns.name")}</TableHead>
          <TableHead>{t("page.columns.mailbox")}</TableHead>
          <TableHead>{t("page.columns.status")}</TableHead>
          <TableHead className={num}>{t("page.columns.enrolled")}</TableHead>
          <TableHead className={num}>{t("page.columns.sent")}</TableHead>
          <TableHead className={num}>{t("page.columns.replied")}</TableHead>
          <TableHead className={num}>{t("page.columns.bounced")}</TableHead>
          <TableHead>{t("page.columns.updated")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="max-w-64 truncate font-medium">
              <Link href={`/campaigns/${row.id}`} className="underline-offset-2 hover:underline">
                {row.name}
              </Link>
            </TableCell>
            <TableCell className="max-w-48 truncate text-muted-foreground">
              {row.mailbox ?? t("page.noMailbox")}
            </TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANT[row.status]}>{t(`status.${row.status}`)}</Badge>
            </TableCell>
            <TableCell className={num}>{row.enrolled}</TableCell>
            <TableCell className={num}>{row.sent}</TableCell>
            <TableCell className={num}>{row.replied}</TableCell>
            <TableCell className={num}>{row.bounced}</TableCell>
            <TableCell className="text-muted-foreground">{formatRelative(row.updatedAt, locale, now)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
