import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SellerSummary } from "@/lib/closing/dashboard/team";
import { cn } from "@/lib/utils";

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
    <div className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-5">Vendeur</TableHead>
            <TableHead className="text-right">En cours</TableHead>
            <TableHead className="text-right">Chauds</TableHead>
            <TableHead className="text-right">À risque</TableHead>
            <TableHead className="text-right">Morts</TableHead>
            <TableHead className="text-right">Pipeline</TableHead>
            <TableHead className="pr-5 text-right">Montant mort</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {summaries.map((summary) => (
            <TableRow
              key={summary.sellerId}
              className={cn("relative", selected === summary.sellerId && "bg-muted/60")}
            >
              <TableCell className="pl-5 font-medium">
                <Link
                  href={selected === summary.sellerId ? "/equipe" : `/equipe?vendeur=${summary.sellerId}`}
                  className="outline-none after:absolute after:inset-0 hover:underline focus-visible:after:ring-3 focus-visible:after:ring-ring/30 focus-visible:after:ring-inset"
                >
                  {names.get(summary.sellerId) ?? "Ancien membre"}
                </Link>
              </TableCell>
              <TableCell className="text-right tabular-nums">{summary.open}</TableCell>
              <Count value={summary.hot} dot="bg-heat-hot" />
              <Count value={summary.atRisk} dot="bg-heat-warm" />
              <Count value={summary.dead} dot="bg-heat-cold" />
              <TableCell className="text-right tabular-nums">{formatMoney(summary.pipeline) ?? "–"}</TableCell>
              <TableCell className="pr-5 text-right text-muted-foreground tabular-nums">
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
      <span className={cn("inline-flex items-center gap-1.5", value === 0 && "text-muted-foreground")}>
        {value > 0 && <span aria-hidden className={cn("size-1.5 rounded-full", dot)} />}
        {value}
      </span>
    </TableCell>
  );
}
