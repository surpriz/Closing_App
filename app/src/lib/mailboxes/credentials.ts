import { z } from "zod";

import { decryptSecret, encryptSecret } from "@/lib/crypto";

export type ImapCredentials = {
  v: 1;
  kind: "imap";
  imap: { host: string; port: number; secure: boolean; user: string; pass: string };
  smtp: { host: string; port: number; secure: boolean; user: string; pass: string };
};
export type MicrosoftCredentials = {
  v: 1;
  kind: "microsoft";
  refreshToken: string;
  accessToken: string | null;
  accessTokenExpiresAt: string | null;
  tenantId: string | null;
  scope: string;
};
export type UnipileCredentials = { v: 1; kind: "unipile"; accountId: string };
export type NylasCredentials = { v: 1; kind: "nylas"; grantId: string };
export type MailboxCredentials = ImapCredentials | MicrosoftCredentials | UnipileCredentials | NylasCredentials;

const endpoint = z.object({
  host: z.string().min(1),
  port: z.number().int().positive(),
  secure: z.boolean(),
  user: z.string(),
  pass: z.string(),
});

const credentialsSchema = z.discriminatedUnion("kind", [
  z.object({ v: z.literal(1), kind: z.literal("imap"), imap: endpoint, smtp: endpoint }),
  z.object({
    v: z.literal(1),
    kind: z.literal("microsoft"),
    refreshToken: z.string().min(1),
    accessToken: z.string().nullable(),
    accessTokenExpiresAt: z.string().nullable(),
    tenantId: z.string().nullable(),
    scope: z.string(),
  }),
  z.object({ v: z.literal(1), kind: z.literal("unipile"), accountId: z.string().min(1) }),
  z.object({ v: z.literal(1), kind: z.literal("nylas"), grantId: z.string().min(1) }),
]);

export function encodeCredentials(credentials: MailboxCredentials): string {
  return encryptSecret(JSON.stringify(credentials));
}

/** Throws on a bad payload or an unknown shape: a stored blob we cannot read must never be used half-parsed. */
export function decodeCredentials(payload: string): MailboxCredentials {
  return credentialsSchema.parse(JSON.parse(decryptSecret(payload)));
}
