import { describe, expect, it } from "vitest";

import { addDismissed, parseDismissed } from "./dismissal";
import { capsulesVisibleOnLink, resolveCapsules } from "./resolve";

describe("resolveCapsules", () => {
  const rows = [
    { id: "doc-2", pageNumber: 2, linkId: null },
    { id: "mine-2", pageNumber: 2, linkId: "link-a" },
    { id: "doc-4", pageNumber: 4, linkId: null },
    { id: "other-4", pageNumber: 4, linkId: "link-b" },
  ];

  it("shows the link's own capsule over the document's", () => {
    const byPage = resolveCapsules(rows, "link-a");
    expect(byPage.get(2)?.id).toBe("mine-2");
    expect(byPage.get(4)?.id).toBe("doc-4");
  });

  it("never shows another link's capsule", () => {
    expect(resolveCapsules(rows, "link-c").get(4)?.id).toBe("doc-4");
    expect(resolveCapsules([rows[3]], "link-a").size).toBe(0);
  });

  it("does not depend on row order", () => {
    expect(resolveCapsules([...rows].reverse(), "link-a").get(2)?.id).toBe("mine-2");
  });
});

describe("dismissed capsules", () => {
  it("survives junk in storage", () => {
    expect(parseDismissed(null)).toEqual([]);
    expect(parseDismissed("{oops")).toEqual([]);
    expect(parseDismissed('["a", 3, "b"]')).toEqual(["a", "b"]);
  });

  it("adds each id once", () => {
    expect(addDismissed(["a"], "a")).toEqual(["a"]);
    expect(addDismissed(["a"], "b")).toEqual(["a", "b"]);
  });
});

describe("capsulesVisibleOnLink", () => {
  it("shows a personal link its own clips and the document's", () => {
    expect(capsulesVisibleOnLink({ id: "l1", documentId: "d1" })).toEqual({
      documentId: "d1",
      OR: [{ linkId: null }, { linkId: "l1" }],
    });
  });

  it("shows a shared link the document's clips only", () => {
    expect(capsulesVisibleOnLink({ id: "l1", documentId: "d1", shared: true })).toEqual({ documentId: "d1", linkId: null });
  });
});
