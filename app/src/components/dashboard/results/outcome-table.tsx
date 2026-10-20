import { useTranslations } from "next-intl";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MIN_SAMPLE, successRate, type OutcomeGroup } from "@/lib/closing/results/stats";
import { cn } from "@/lib/utils";

function percent(part: number, whole: number) {
  return whole ? `${Math.round((part / whole) * 100)} %` : "–";
}

/** One line per kind of follow-up: sent, reopened from it, answered, meeting within 14 days. */
export function OutcomeTable({ groups, label }: { groups: (OutcomeGroup & { label: string })[]; label: string }) {
  const t = useTranslations("results.table");
  const best = Math.max(0, ...groups.map((g) => successRate(g) ?? 0));

  return (
    <div className="border-b border-foreground bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">{label}</TableHead>
            <TableHead className="text-right">{t("sent")}</TableHead>
            <TableHead className="text-right">{t("clicked")}</TableHead>
            <TableHead className="text-right">{t("replied")}</TableHead>
            <TableHead className="pr-4 text-right">{t("meetings")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => {
            const rate = successRate(group);
            return (
              <TableRow key={group.key} className={cn(group.sent < MIN_SAMPLE && "text-muted-foreground")}>
                <TableCell className="pl-4">
                  <span className="inline-flex items-center gap-1.5">
                    {rate !== null && rate > 0 && rate === best && <span aria-hidden className="size-2 bg-success" />}
                    {group.label}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{group.sent}</TableCell>
                <TableCell className="text-right tabular-nums">{percent(group.clicked, group.sent)}</TableCell>
                <TableCell className="text-right tabular-nums">{percent(group.replied, group.sent)}</TableCell>
                <TableCell className="pr-4 text-right tabular-nums">{percent(group.meetings, group.sent)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
