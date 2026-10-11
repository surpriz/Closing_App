import { describe, expect, it } from "vitest";

import { expiredArchiveWhere, retentionCutoffs, staleLinkWhere } from "./purge";

describe("retentionCutoffs", () => {
  const now = new Date("2026-10-11T12:00:00Z");

  it("keeps tracking data 12 months", () => {
    expect(retentionCutoffs(now).tracking.toISOString()).toBe("2025-10-11T12:00:00.000Z");
  });

  it("gives archived documents 30 days", () => {
    expect(retentionCutoffs(now).archive.toISOString()).toBe("2026-09-11T12:00:00.000Z");
  });

  it("keeps signatures 5 years", () => {
    expect(retentionCutoffs(now).signature.toISOString()).toBe("2021-10-11T12:00:00.000Z");
  });
});

describe("staleLinkWhere", () => {
  const cutoff = new Date("2025-10-11T12:00:00Z");
  const where = staleLinkWhere(cutoff);

  it("counts a never opened link from its creation", () => {
    expect(where.OR).toEqual([
      { lastActivityAt: { lt: cutoff } },
      { lastActivityAt: null, createdAt: { lt: cutoff } },
    ]);
  });

  it("skips links whose only reader data is a signature", () => {
    const conditions = (where.AND as { OR: object[] }[])[0].OR;
    expect(conditions).toContainEqual({ actions: { some: { type: { notIn: ["VALIDATE_SIGN"] } } } });
    expect(conditions).not.toContainEqual({ actions: { some: {} } });
  });
});

describe("expiredArchiveWhere", () => {
  it("never deletes a document holding a signature", () => {
    const cutoff = new Date("2026-09-11T12:00:00Z");
    expect(expiredArchiveWhere(cutoff)).toEqual({
      archivedAt: { lt: cutoff },
      links: { none: { actions: { some: { type: { in: ["VALIDATE_SIGN"] } } } } },
    });
  });
});
