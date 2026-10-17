"use server";

import { z } from "zod";

import { FORWARD_MESSAGE_MAX } from "@/lib/closing/forward/limits";
import { forwardDocument, type ForwardError } from "@/lib/closing/forward/forward";
import { containsLink } from "@/lib/closing/forward/rules";
import { SIGNER_NAME } from "@/lib/closing/i18n/signed-email";

export type ForwardResult = { ok: true } | { ok: false; error: ForwardError | "invalid_email" | "invalid_name" | "invalid_message" };

const email = z.email().max(254);
// Names land in an email and its From: letters only, never a link or an address slipped in
const name = z.string().trim().regex(SIGNER_NAME).nullable();

const forwardSchema = z.object({
  slug: z.string().min(1).max(64),
  viewId: z.string().max(64).nullable(),
  to: email,
  toName: name,
  message: z.string().trim().max(FORWARD_MESSAGE_MAX).nullable(),
  fromEmail: email.nullable(),
  fromName: name,
  notifyOnOpen: z.boolean(),
});

const clean = (value: string | null | undefined) => value?.trim() || null;

/** "Transférer" from the viewer. */
export async function submitForward(input: z.input<typeof forwardSchema>): Promise<ForwardResult> {
  const parsed = forwardSchema.safeParse({
    ...input,
    to: input.to.trim().toLowerCase(),
    toName: clean(input.toName),
    message: clean(input.message),
    fromEmail: clean(input.fromEmail)?.toLowerCase() ?? null,
    fromName: clean(input.fromName),
  });
  if (!parsed.success) {
    const fields = new Set(parsed.error.issues.map((issue) => issue.path[0]));
    if (fields.has("message")) return { ok: false, error: "invalid_message" };
    return { ok: false, error: fields.has("toName") || fields.has("fromName") ? "invalid_name" : "invalid_email" };
  }
  if (parsed.data.message && containsLink(parsed.data.message)) return { ok: false, error: "invalid_message" };
  return forwardDocument(parsed.data);
}
