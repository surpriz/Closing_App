import { createHmac, timingSafeEqual } from "node:crypto";

export type UnsubscribeSubject = { kind: "prospect" | "enrollment"; id: string };

const PREFIX = { prospect: "p", enrollment: "e" } as const;

function sign(subject: string, secret: string) {
  return createHmac("sha256", secret).update(`unsubscribe:${subject}`).digest("base64url");
}

/**
 * "p-<id>" or "e-<id>": the kind is signed with the id, so a token cannot be replayed on another table.
 * "-" (not ":") because Next re-encodes page params and ":" would arrive as "%3A"; cuids never contain "-".
 */
export function encodeUnsubscribeSubject(s: UnsubscribeSubject): string {
  return `${PREFIX[s.kind]}-${s.id}`;
}

/** Accepts "p-"/"e-", the legacy "p:"/"e:" forms, and a bare id (a prospect: links sent before enrollments existed). */
export function parseUnsubscribeSubject(subject: string): UnsubscribeSubject | null {
  const match = /^([a-z])[-:](.*)$/.exec(subject);
  if (!match) return subject ? { kind: "prospect", id: subject } : null;
  const [, prefix, id] = match;
  if (!id) return null;
  if (prefix === PREFIX.prospect) return { kind: "prospect", id };
  if (prefix === PREFIX.enrollment) return { kind: "enrollment", id };
  return null;
}

export function createUnsubscribeToken(subject: string, secret: string) {
  return `${subject}.${sign(subject, secret)}`;
}

export function verifyUnsubscribeToken(token: string, secret: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;

  const subject = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(subject, secret));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  return subject;
}
