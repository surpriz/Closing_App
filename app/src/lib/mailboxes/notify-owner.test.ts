import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMany = vi.fn();
const findUnique = vi.fn();
const PREV = new Date("2026-11-18T12:00:00Z");
vi.mock("@/lib/db", () => ({
  prisma: { mailbox: { updateMany: (...a: unknown[]) => updateMany(...a), findUnique: (...a: unknown[]) => findUnique(...a) } },
}));
const sendEmail = vi.fn();
const isEmailConfigured = vi.fn();
vi.mock("@/lib/email", () => ({
  sendEmail: (...a: unknown[]) => sendEmail(...a),
  isEmailConfigured: () => isEmailConfigured(),
}));
vi.mock("@/lib/app-origin", () => ({ getPublicAppUrl: () => "https://app.example.com" }));

const { notifyMailboxOwner, OWNER_NOTIFY_COOLDOWN_MS } = await import("./notify-owner");

const now = new Date("2026-11-20T12:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  isEmailConfigured.mockReturnValue(true);
  updateMany.mockResolvedValue({ count: 1 });
  findUnique.mockResolvedValue({ errorNotifiedAt: PREV, email: "me@acme.com", user: { email: "owner@acme.com", locale: "fr" } });
});

describe("notifyMailboxOwner", () => {
  it("does nothing when email is not configured", async () => {
    isEmailConfigured.mockReturnValue(false);
    expect(await notifyMailboxOwner("mb", "auth_revoked", null, now)).toBe(false);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("reserves the episode with the 24 h cooldown and skips when already notified", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    expect(await notifyMailboxOwner("mb", "send_failed", "x", now)).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
    const { where, data } = updateMany.mock.calls[0][0];
    expect(where.OR[1].errorNotifiedAt.lt).toEqual(new Date(now.getTime() - OWNER_NOTIFY_COOLDOWN_MS));
    expect(data).toEqual({ errorNotifiedAt: now });
  });

  it("sends the French subject to the owner when their locale is fr", async () => {
    expect(await notifyMailboxOwner("mb", "auth_revoked", "AUTH_REVOKED: invalid_grant", now)).toBe(true);
    const mail = sendEmail.mock.calls[0][0];
    expect(mail.to).toBe("owner@acme.com");
    expect(mail.subject).toBe("Votre boîte me@acme.com doit être reconnectée");
    expect(mail.text).toContain("invalid_grant");
    expect(mail.text).toContain("https://app.example.com/settings#boite");
    expect(mail.html).toContain('href="https://app.example.com/settings#boite"');
  });

  it("releases the reservation when sendEmail throws, and never throws", async () => {
    sendEmail.mockRejectedValue(new Error("ses down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await notifyMailboxOwner("mb", "sync_failed", null, now)).toBe(false);
    expect(updateMany).toHaveBeenLastCalledWith({ where: { id: "mb", errorNotifiedAt: now }, data: { errorNotifiedAt: PREV } });
  });

  it("leaves the detail line out when there is none", async () => {
    await notifyMailboxOwner("mb", "sync_failed", null, now);
    expect(sendEmail.mock.calls[0][0].text).not.toContain("Détail");
  });
});
