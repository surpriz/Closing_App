import type { Metadata } from "next";
import Link from "next/link";

import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader, SectionTitle, Stat } from "@/components/dashboard/page-header";
import { DealColumn } from "@/components/dashboard/team/deal-column";
import { formatMoney, sumMoney } from "@/components/dashboard/team/money";
import { SellerTable } from "@/components/dashboard/team/seller-table";
import { buttonVariants } from "@/components/ui/button";
import { compareDeals } from "@/lib/closing/dashboard/rank";
import { getTeamBoard, type TeamDealRow } from "@/lib/closing/dashboard/team-queries";
import { requireManager } from "@/lib/session";

export const metadata: Metadata = { title: "Équipe" };

const COLUMN_LIMIT = 15;
const REFRESH_MS = 60_000;

// Dead deals by what they were worth: the ones to chase or close first
const byAmount = (a: TeamDealRow, b: TeamDealRow) => (b.amountCents ?? -1) - (a.amountCents ?? -1) || compareDeals(a, b);

export default async function TeamPage(props: PageProps<"/equipe">) {
  const { organization } = await requireManager("/equipe");
  const now = new Date();
  const board = await getTeamBoard(organization.id, now);

  const names = new Map(board.sellers.map((seller) => [seller.id, seller.name]));
  const param = (await props.searchParams).vendeur;
  const selected = typeof param === "string" && names.has(param) ? param : null;
  const rows = selected ? board.rows.filter((row) => row.sellerId === selected) : board.rows;
  const summaries = selected ? board.summaries.filter((s) => s.sellerId === selected) : board.summaries;

  const hot = rows.filter((row) => row.health === "hot").sort(compareDeals);
  const atRisk = rows.filter((row) => row.health === "at_risk").sort(compareDeals);
  const dead = rows.filter((row) => row.health === "dead").sort(byAmount);
  const pipeline = formatMoney(sumMoney(summaries.map((s) => s.pipeline)));
  const deadAmount = formatMoney(sumMoney(summaries.map((s) => s.deadAmount)));
  // The seller is in the page title: no need to repeat it on every deal
  const dealNames = selected || board.sellers.length < 2 ? null : names;

  return (
    <div className="space-y-10">
      <AutoRefresh intervalMs={REFRESH_MS} />
      <PageHeader
        title={selected ? names.get(selected) : "Équipe"}
        description={
          selected
            ? "Ses deals en cours : ce qui avance, ce qui glisse, ce qui est à classer."
            : "Les deals en cours de toute l'équipe : ce qui avance, ce qui glisse, ce qui est à classer."
        }
        action={
          selected ? (
            <Link href="/equipe" className={buttonVariants({ variant: "outline" })}>
              Toute l&apos;équipe
            </Link>
          ) : board.sellers.length < 2 ? (
            <Link href="/settings#equipe" className={buttonVariants({ variant: "outline" })}>
              Inviter un commercial
            </Link>
          ) : null
        }
      />

      {board.rows.length === 0 ? (
        <EmptyState
          title="Aucun deal en cours dans l'équipe."
          description="Dès qu'un commercial envoie une proposition, elle apparaît ici avec sa température."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-5">
            <Stat label="En cours" value={rows.length} />
            <Stat label="Chauds" value={hot.length} tone="hot" />
            <Stat label="À risque" value={atRisk.length} tone="warm" />
            <Stat label="Morts" value={dead.length} tone="cold" hint={deadAmount ?? undefined} />
            <Stat label="Pipeline" value={pipeline ?? "–"} className="col-span-2 sm:col-span-1" />
          </div>

          {board.sellers.length > 1 && (
            <section>
              <SectionTitle hint="cliquez pour ne voir que ses deals">Par commercial</SectionTitle>
              <SellerTable summaries={summaries} names={names} selected={selected} />
            </section>
          )}

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <DealColumn
              title="Chauds"
              hint="à suivre de près"
              empty="Aucun deal chaud en ce moment."
              rows={hot}
              names={dealNames}
              now={now}
              limit={COLUMN_LIMIT}
            />
            <DealColumn
              title="À risque"
              hint="en train de refroidir"
              empty="Rien ne refroidit."
              rows={atRisk}
              names={dealNames}
              now={now}
              limit={COLUMN_LIMIT}
            />
            <DealColumn
              title="Morts"
              hint="à relancer une dernière fois ou à classer"
              empty="Aucun deal mort."
              rows={dead}
              names={dealNames}
              now={now}
              limit={COLUMN_LIMIT}
            />
          </div>

          {board.capped && (
            <p className="text-sm text-muted-foreground">
              Seuls les 500 deals en cours les plus récents sont comptés : il y a sans doute plus de deals morts.
            </p>
          )}
        </>
      )}
    </div>
  );
}
