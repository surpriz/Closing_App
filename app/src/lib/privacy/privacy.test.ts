import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/blob", () => ({}));

const { alertsWhere, normalizeEmail } = await import("./prospect");
const { findDeletionBlocker } = await import("./workspace");

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Jane.Doe@ACME.fr ")).toBe("jane.doe@acme.fr");
  });
});

describe("alertsWhere", () => {
  it("matches alerts by email or by one of the reader's views, inside the workspace", () => {
    expect(alertsWhere("org1", "jane@acme.fr", ["v1", "v2"])).toEqual({
      link: { organizationId: "org1" },
      OR: [
        { payload: { path: ["prospectEmail"], equals: "jane@acme.fr" } },
        { payload: { path: ["viewId"], equals: "v1" } },
        { payload: { path: ["viewId"], equals: "v2" } },
      ],
    });
  });
});

describe("findDeletionBlocker", () => {
  const workspace = (members: { userId: string; role: string }[]) => ({ name: "Acme", members });

  it("lets a plain member leave", () => {
    const org = workspace([{ userId: "me", role: "member" }, { userId: "boss", role: "owner" }]);
    expect(findDeletionBlocker("me", [{ role: "member", organization: org }])).toBeNull();
  });

  it("lets an owner leave when another owner stays", () => {
    const org = workspace([{ userId: "me", role: "owner" }, { userId: "co", role: "admin,owner" }]);
    expect(findDeletionBlocker("me", [{ role: "owner", organization: org }])).toBeNull();
  });

  it("stops the last owner of a team", () => {
    const org = workspace([{ userId: "me", role: "owner" }, { userId: "sales", role: "admin" }]);
    expect(findDeletionBlocker("me", [{ role: "owner", organization: org }])).toEqual({
      kind: "last_owner",
      workspace: "Acme",
    });
  });

  it("sends a solo owner to workspace deletion", () => {
    const org = workspace([{ userId: "me", role: "owner" }]);
    expect(findDeletionBlocker("me", [{ role: "owner", organization: org }])?.kind).toBe("sole_member");
  });
});
