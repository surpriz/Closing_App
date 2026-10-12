import type { Prisma, TargetProfile } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

import { EMPTY_TARGET, targetFiltersSchema, type TargetFilters } from "./target";

const FILTER_FIELDS = Object.keys(EMPTY_TARGET) as (keyof TargetFilters)[];

export function filtersOf(profile: Pick<TargetProfile, keyof TargetFilters>): TargetFilters {
  return Object.fromEntries(FILTER_FIELDS.map((field) => [field, profile[field]])) as TargetFilters;
}

export function activeTarget(organizationId: string) {
  return prisma.targetProfile.findFirst({
    where: { organizationId, active: true },
    orderBy: { createdAt: "desc" },
  });
}

/** A new version each time: past runs keep pointing at the target they searched. */
export async function saveTarget(input: {
  organizationId: string;
  userId: string;
  filters: TargetFilters;
  origin: "MANUAL" | "INFERRED";
  evidence?: Prisma.InputJsonValue | null;
}) {
  const filters = targetFiltersSchema.parse(input.filters);
  return prisma.$transaction(async (tx) => {
    await tx.targetProfile.updateMany({
      where: { organizationId: input.organizationId, active: true },
      data: { active: false },
    });
    return tx.targetProfile.create({
      data: {
        organizationId: input.organizationId,
        createdById: input.userId,
        origin: input.origin,
        ...filters,
        inferredEvidence: input.evidence ?? undefined,
      },
    });
  });
}
