"use server";

import { unsubscribeByToken } from "@/lib/closing/unsubscribe";

export type UnsubscribeState = { done: boolean; error?: boolean } | null;

export async function confirmUnsubscribe(token: string): Promise<UnsubscribeState> {
  const ok = await unsubscribeByToken(token);
  return ok ? { done: true } : { done: false, error: true };
}
