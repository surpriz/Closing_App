import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/blob", () => ({}));

const { hasPdfHeader } = await import("./process-document");
const { documentNameFromFile } = await import("./create-document");

const bytes = (text: string) => new TextEncoder().encode(text);

describe("hasPdfHeader", () => {
  it("accepts a PDF", () => {
    expect(hasPdfHeader(bytes("%PDF-1.7\n%âãÏÓ\n1 0 obj"))).toBe(true);
  });

  it("accepts a header after a few junk bytes", () => {
    expect(hasPdfHeader(bytes(`${" ".repeat(500)}%PDF-1.4`))).toBe(true);
  });

  it("rejects anything else sent as application/pdf", () => {
    expect(hasPdfHeader(bytes("<html><script>alert(1)</script></html>"))).toBe(false);
    expect(hasPdfHeader(bytes(`${" ".repeat(2000)}%PDF-1.4`))).toBe(false);
  });
});

describe("documentNameFromFile", () => {
  it("drops the extension and control characters", () => {
    expect(documentNameFromFile("Devis\u0000 Acme\n.PDF")).toBe("Devis Acme");
  });

  it("caps the length and never returns an empty name", () => {
    expect(documentNameFromFile(`${"a".repeat(300)}.pdf`)).toHaveLength(200);
    expect(documentNameFromFile(".pdf")).toBe("Document");
  });
});
