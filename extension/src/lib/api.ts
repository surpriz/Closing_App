import { browser } from "wxt/browser";

import { API_ORIGIN } from "./config";
import { ClozerError } from "./messages";

const TOKEN_KEY = "token";

export async function getToken() {
  const stored = await browser.storage.local.get(TOKEN_KEY);
  return (stored[TOKEN_KEY] as string | undefined) ?? null;
}

export function setToken(token: string | null) {
  return token ? browser.storage.local.set({ [TOKEN_KEY]: token }) : browser.storage.local.remove(TOKEN_KEY);
}

// Calls /api/ext/* with the seller's token. Only the background uses this.
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await getToken();
  if (!token) throw new ClozerError("unauthorized", "Connectez l'extension à votre compte Clozer.");

  let res: globalThis.Response;
  try {
    res = await fetch(`${API_ORIGIN}${path}`, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ClozerError("network", "Clozer est injoignable. Vérifiez votre connexion.");
  }

  if (res.status === 401) {
    await setToken(null);
    throw new ClozerError("unauthorized", "Reconnectez l'extension à votre compte Clozer.");
  }
  if (res.status === 204) return undefined as T;

  const data = (await res.json().catch(() => null)) as (T & { error?: string; message?: string }) | null;
  if (!res.ok || !data) {
    throw new ClozerError(data?.error ?? "server", data?.message ?? "Clozer n'a pas pu traiter la demande.");
  }
  return data;
}
