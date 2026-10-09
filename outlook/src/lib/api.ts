import { APP_ORIGIN } from "./config";
import { ClozerError } from "./errors";
import { getToken, setToken } from "./settings";

// Calls /api/ext/* with the seller's token, like the Chrome extension's background
export async function api<T>(path: string, init: { method?: string; body?: unknown; anonymous?: boolean; keepalive?: boolean } = {}): Promise<T> {
  const token = init.anonymous ? null : getToken();
  if (!init.anonymous && !token) throw new ClozerError("unauthorized", "Connectez Outlook à votre compte Clozer.");

  let res: Response;
  try {
    res = await fetch(`${APP_ORIGIN}${path}`, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      // Lets the request finish after the send handler has let the email go
      keepalive: init.keepalive,
    });
  } catch {
    throw new ClozerError("network", "Clozer est injoignable. Vérifiez votre connexion.");
  }

  if (res.status === 401 && token) {
    await setToken(null).catch(() => undefined);
    throw new ClozerError("unauthorized", "Reconnectez Outlook à votre compte Clozer.");
  }
  if (res.status === 204) return undefined as T;

  const data = (await res.json().catch(() => null)) as (T & { error?: string; message?: string }) | null;
  if (!res.ok || !data) {
    throw new ClozerError(data?.error ?? "server", data?.message ?? "Clozer n'a pas pu traiter la demande.");
  }
  return data;
}

export type Account = {
  user: { name: string; email: string };
  organization: { id: string; name: string };
  appOrigin: string;
  disabledHosts: string[];
  notificationsEnabled?: boolean;
};

export type DocumentSummary = { id: string; name: string; status?: string; titled?: boolean };

export type LinkCreated = { id: string; name: string | null; title: string; url: string };
