import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SellerSummary } from "@/lib/closing/dashboard/team";
import { cn } from "@/lib/utils";

import { TEAM_HEALTH_LABELS } from "../labels";

import { formatMoney } from "./money";

/** One line per seller: how many deals, how they are doing, what is at stake. */
export function SellerTable({
  summaries,
  names,
  selected,
}: {
  summaries: SellerSummary[];
  names: Map<string, string>;
  selected: string | null;
}) {
  return (
    <div className="border-b border-foreground bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Vendeur</TableHead>
            <TableHead className="text-right">En cours</TableHead>
            <TableHead className="text-right">
              {TEAM_HEALTH_LABELS.hot}
            </TableHead>
            <TableHead className="text-right">
              {TEAM_HEALTH_LABELS.at_risk}
            </TableHead>
            <TableHead className="text-right">
              {TEAM_HEALTH_LABELS.dead}
            </TableHead>
            <TableHead className="text-right">Pipeline</TableHead>
            <TableHead className="pr-4 text-right">Montant à classer</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {summaries.map((summary) => (
            <TableRow
              key={summary.sellerId}
              className={cn(
                "relative",
                selected === summary.sellerId && "bg-muted/60",
              )}
            >
              <TableCell className="pl-4 font-semibold">
                <Link
                  href={
                    selected === summary.sellerId
                      ? "/equipe"
                      : `/equipe?vendeur=${summary.sellerId}`
                  }
                  className="outline-none after:absolute after:inset-0 hover:underline focus-visible:after:ring-3 focus-visible:after:ring-ring/30 focus-visible:after:ring-inset"
                >
                  {names.get(summary.sellerId) ?? "Ancien membre"}
                </Link>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {summary.open}
              </TableCell>
              <Count value={summary.hot} dot="bg-success" />
              <Count value={summary.atRisk} dot="bg-warning" />
              <Count value={summary.dead} dot="bg-foreground/30" />
              <TableCell className="text-right tabular-nums">
                {formatMoney(summary.pipeline) ?? "–"}
              </TableCell>
              <TableCell className="pr-4 text-right text-muted-foreground tabular-nums">
                {formatMoney(summary.deadAmount) ?? "–"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Count({ value, dot }: { value: number; dot: string }) {
  return (
    <TableCell className="text-right tabular-nums">
      <span
        className={cn(
          "inline-flex items-center gap-1.5",
          value === 0 && "text-muted-foreground",
        )}
      >
        {value > 0 && (
          <span aria-hidden className={cn("size-2", dot)} />
        )}
        {value}
      </span>
    </TableCell>
  );
}
