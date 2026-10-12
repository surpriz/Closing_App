import { DAY_MS } from "@/lib/closing/constants";
import { prisma } from "@/lib/db";

/** AI spend over the last 30 days, per workspace, in micro-dollars. */
export async function aiCostLast30Days(organizationIds?: string[], now = new Date()) {
  const rows = await prisma.aiUsage.groupBy({
    by: ["organizationId"],
    where: {
      createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) },
      ...(organizationIds && { organizationId: { in: organizationIds } }),
    },
    _sum: { costMicroUsd: true },
  });
  return new Map(rows.map((row) => [row.organizationId, row._sum.costMicroUsd ?? 0]));
}
