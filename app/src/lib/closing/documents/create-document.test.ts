import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/blob", () => ({}));
vi.mock("./process-document", () => ({}));
vi.mock("./read-pages", () => ({ MAX_AI_ATTEMPTS: 3 }));

const { documentSummary } = await import("./create-document");

const row = { id: "d", name: "Facture_20_10_2026", status: "PROCESSING", docType: null, aiProcessedAt: null, aiAttempts: 0 };

describe("documentSummary", () => {
  it("tells the extension to wait for a fresh upload", () => {
    expect(documentSummary(row)).toEqual({ id: "d", name: "Facture_20_10_2026", status: "PROCESSING", titled: false });
    expect(documentSummary({ ...row, status: "READY" }).titled).toBe(false);
  });

  it("is titled once the AI classified it, or when it never will", () => {
    expect(documentSummary({ ...row, status: "READY", docType: "INVOICE" }).titled).toBe(true);
    expect(documentSummary({ ...row, status: "READY", aiProcessedAt: new Date() }).titled).toBe(true);
    expect(documentSummary({ ...row, status: "FAILED" }).titled).toBe(true);
    expect(documentSummary({ ...row, status: "READY", aiAttempts: 3 }).titled).toBe(true);
  });
});
