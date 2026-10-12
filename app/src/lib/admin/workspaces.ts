import { DAY_MS } from "@/lib/closing/constants";
import { prisma } from "@/lib/db";

export const WORKSPACE_FILTERS = {
  actif: { label: "Actifs", where: { suspendedAt: null } },
  suspendu: { label: "Suspendus", where: { suspendedAt: { not: null } } },
} as const;

const last30Days = (now: Date) => ({ createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) } });

/** AI spend over the last 30 days, per workspace, in micro-dollars. */
export async function aiCostLast30Days(organizationIds: string[], now = new Date()) {
  const rows = await prisma.aiUsage.groupBy({
    by: ["organizationId"],
    where: { ...last30Days(now), organizationId: { in: organizationIds } },
    _sum: { costMicroUsd: true },
  });
  return new Map(rows.map((row) => [row.organizationId, row._sum.costMicroUsd ?? 0]));
}

/** The workspaces that cost the most in AI over the last 30 days, with the total. */
export async function topAiCostsLast30Days(limit: number, now = new Date()) {
  const [total, rows] = await Promise.all([
    prisma.aiUsage.aggregate({ where: last30Days(now), _sum: { costMicroUsd: true } }),
    prisma.aiUsage.groupBy({
      by: ["organizationId"],
      where: last30Days(now),
      _sum: { costMicroUsd: true },
      orderBy: { _sum: { costMicroUsd: "desc" } },
      take: limit,
    }),
  ]);
  const names = new Map(
    (
      await prisma.organization.findMany({
        where: { id: { in: rows.map((row) => row.organizationId) } },
        select: { id: true, name: true },
      })
    ).map((org) => [org.id, org.name]),
  );
  return {
    total: total._sum.costMicroUsd ?? 0,
    top: rows.map((row) => ({
      organizationId: row.organizationId,
      name: names.get(row.organizationId) ?? null,
      cost: row._sum.costMicroUsd ?? 0,
    })),
  };
}
