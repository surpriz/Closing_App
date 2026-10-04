import { createHash, randomBytes } from "node:crypto";

// Browser extension credentials. High-entropy, so a plain sha256 is enough to store them.
const PREFIX = "clz_ext_";
const TOKEN = /^clz_ext_[A-Za-z0-9_-]{43}$/;

export function generateExtensionToken() {
  return `${PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function hashExtensionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenHint(token: string) {
  return token.slice(-4);
}

// "Bearer clz_ext_..." → the token, or null for anything else
export function parseBearer(header: string | null) {
  const match = header?.match(/^Bearer\s+(\S+)\s*$/i);
  const token = match?.[1];
  return token && TOKEN.test(token) ? token : null;
}
