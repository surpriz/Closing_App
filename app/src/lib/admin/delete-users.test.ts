import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/blob", () => ({}));

const { planUsersDeletion } = await import("./delete-users");

const ws = (id: string, members: [string, string][]) => ({
  id,
  name: id,
  members: members.map(([userId, role]) => ({ userId, role })),
});

describe("planUsersDeletion", () => {
  it("deletes a workspace nobody stays in", () => {
    const plan = planUsersDeletion(["a"], [ws("solo", [["a", "owner"]])]);
    expect(plan).toEqual({ emptied: ["solo"], shared: [], ownerless: [] });
  });

  it("deletes a team workspace when the whole team goes", () => {
    const plan = planUsersDeletion(["a", "b"], [ws("team", [["a", "owner"], ["b", "member"]])]);
    expect(plan.emptied).toEqual(["team"]);
  });

  it("keeps a workspace someone stays in", () => {
    const plan = planUsersDeletion(["b"], [ws("team", [["a", "owner"], ["b", "member"]])]);
    expect(plan).toEqual({ emptied: [], shared: ["team"], ownerless: [] });
  });

  it("refuses to leave a team without an owner", () => {
    const plan = planUsersDeletion(["a"], [ws("team", [["a", "owner"], ["b", "admin"]])]);
    expect(plan.ownerless).toEqual(["team"]);
  });

  it("is fine when another owner stays", () => {
    const plan = planUsersDeletion(["a"], [ws("team", [["a", "owner"], ["b", "admin,owner"]])]);
    expect(plan.shared).toEqual(["team"]);
  });
});
