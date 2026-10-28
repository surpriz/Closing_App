import { beforeEach, describe, expect, it, vi } from "vitest";

const hasToken = vi.fn();
vi.mock("@/lib/mailboxes/webhooks/token", () => ({ hasMailboxWebhookToken: (...a: unknown[]) => hasToken(...a) }));
const syncMailboxNow = vi.fn();
vi.mock("@/lib/mailboxes/inbound/sync", () => ({ syncMailboxNow: (...a: unknown[]) => syncMailboxNow(...a) }));
const handle = vi.fn();
vi.mock("@/lib/mailboxes/webhooks/microsoft", async () => ({
  ...(await vi.importActual<object>("@/lib/mailboxes/webhooks/microsoft")),
  handleMicrosoftNotifications: (...a: unknown[]) => handle(...a),
}));
const afterTasks: Array<() => unknown> = [];
vi.mock("next/server", async () => ({
  ...(await vi.importActual<object>("next/server")),
  after: (task: () => unknown) => afterTasks.push(task),
}));

const { POST } = await import("./route");

const call = (query = "", body: unknown = { value: [] }) =>
  POST(
    new Request(`https://app.test/api/webhooks/mailboxes/microsoft?token=t${query}`, {
      method: "POST",
      body: JSON.stringify(body),
    }) as never,
  );

beforeEach(() => {
  vi.clearAllMocks();
  afterTasks.length = 0;
  hasToken.mockReturnValue(true);
  handle.mockResolvedValue({ syncMailboxIds: [] });
  syncMailboxNow.mockResolvedValue({ outcome: "synced" });
});

describe("POST /api/webhooks/mailboxes/microsoft", () => {
  it("echoes the validation token as text/plain", async () => {
    const res = await call("&validationToken=Validation%3A+ok");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(await res.text()).toBe("Validation: ok");
    expect(handle).not.toHaveBeenCalled();
  });

  it("refuses a bad URL token, validation included, with no side effect", async () => {
    hasToken.mockReturnValue(false);
    expect((await call("&validationToken=abc")).status).toBe(401);
    expect((await call()).status).toBe(401);
    expect(handle).not.toHaveBeenCalled();
  });

  it("answers 202 and syncs in the background", async () => {
    handle.mockResolvedValue({ syncMailboxIds: ["mb1", "mb2"] });
    const res = await call();
    expect(res.status).toBe(202);
    expect(syncMailboxNow).not.toHaveBeenCalled();
    await Promise.all(afterTasks.map((task) => task()));
    expect(syncMailboxNow).toHaveBeenCalledTimes(2);
    expect(syncMailboxNow).toHaveBeenCalledWith("mb1", expect.any(Date));
  });

  it("stays 202 when the handler throws or the body is not JSON", async () => {
    handle.mockRejectedValue(new Error("db down"));
    expect((await call()).status).toBe(202);
    const res = await POST(new Request("https://app.test/x?token=t", { method: "POST", body: "nope" }) as never);
    expect(res.status).toBe(202);
  });
});
