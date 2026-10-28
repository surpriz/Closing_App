import { beforeEach, describe, expect, it, vi } from "vitest";

const env = { MAILBOX_WEBHOOK_TOKEN: "tok", NYLAS_WEBHOOK_SECRET: "sec" };
vi.mock("@/lib/env", () => ({ getEnv: () => env }));
const prisma = { mailbox: { findMany: vi.fn(), updateMany: vi.fn() } };
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("next/server", async (orig) => ({ ...(await orig<object>()), after: (fn: () => unknown) => void fn() }));
vi.mock("@/lib/mailboxes/inbound/sync", () => ({ syncMailbox: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/mailboxes/notify-owner", () => ({ notifyMailboxOwner: vi.fn() }));

const { GET, POST } = await import("./route");
const { signPayload } = await import("@/lib/crypto");

const body = JSON.stringify({ type: "message.created", data: { object: { grant_id: "g1" } } });
const post = (url: string, sig: string | null, text = body) => {
  const request = new Request(url, { method: "POST", body: text, headers: sig ? { "x-nylas-signature": sig } : {} });
  return request as never;
};
beforeEach(() => vi.clearAllMocks());

describe("nylas webhook route", () => {
  it("rejects a wrong token before reading the body", async () => {
    const request = post("https://x.test/w?token=nope", signPayload(body, "sec"));
    const text = vi.spyOn(request as unknown as Request, "text");
    expect((await POST(request)).status).toBe(401);
    expect(text).not.toHaveBeenCalled();
  });
  it("rejects a wrong signature without touching the database", async () => {
    expect((await POST(post("https://x.test/w?token=tok", signPayload(body, "other")))).status).toBe(401);
    expect((await POST(post("https://x.test/w?token=tok", null))).status).toBe(401);
    expect(prisma.mailbox.findMany).not.toHaveBeenCalled();
  });
  it("accepts a signed event and answers 200", async () => {
    prisma.mailbox.findMany.mockResolvedValue([{ id: "mb1" }]);
    expect((await POST(post("https://x.test/w?token=tok", signPayload(body, "sec")))).status).toBe(200);
    expect(prisma.mailbox.updateMany).toHaveBeenCalled();
  });
  it("still answers 200 on a signed payload that is not JSON", async () => {
    expect((await POST(post("https://x.test/w?token=tok", signPayload("nope", "sec"), "nope"))).status).toBe(200);
  });
  it("echoes the challenge as plain text", async () => {
    const res = await GET(new Request("https://x.test/w?token=tok&challenge=abc-1") as never);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("abc-1");
    expect(res.headers.get("content-type")).toBe("text/plain");
  });
  it("refuses a challenge without the token or with markup", async () => {
    expect((await GET(new Request("https://x.test/w?challenge=abc") as never)).status).toBe(401);
    expect((await GET(new Request("https://x.test/w?token=tok&challenge=%3Cb%3E") as never)).status).toBe(400);
  });
});
