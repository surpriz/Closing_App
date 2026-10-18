import type { SupportedLocale } from "../constants";

/**
 * DeepL's document API: a PDF goes up, a translated PDF with the same layout
 * comes back. Asynchronous (upload, ask for the status, download), and each
 * result can be downloaded once only.
 */

/** DeepL bills a PDF at least this many characters, however short it is. */
export const DEEPL_MIN_BILLED_CHARS = 50_000;

const TARGETS: Record<SupportedLocale, string> = {
  en: "EN-US",
  fr: "FR",
  es: "ES",
  de: "DE",
  it: "IT",
  pt: "PT-PT",
};

export type DeeplConfig = { apiKey: string; baseUrl: string };

/** Null without a key: PDFs are then not offered in other languages. */
export function deeplConfig(apiKey = process.env.DEEPL_API_KEY): DeeplConfig | null {
  if (!apiKey) return null;
  return { apiKey, baseUrl: apiKey.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com" };
}

export function deeplTarget(locale: SupportedLocale) {
  return TARGETS[locale];
}

/** What a translated PDF costs, in µ$, the minimum billing included. */
export function deeplCostMicroUsd(billedCharacters: number | null | undefined, pricePerMillionUsd: number) {
  return Math.round(Math.max(billedCharacters ?? 0, DEEPL_MIN_BILLED_CHARS) * pricePerMillionUsd);
}

export class DeeplError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function call(config: DeeplConfig, path: string, body: FormData | URLSearchParams) {
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: { Authorization: `DeepL-Auth-Key ${config.apiKey}` },
    body,
    signal: AbortSignal.timeout(50_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new DeeplError(`DeepL ${path} ${response.status} ${detail.slice(0, 200)}`, response.status);
  }
  return response;
}

export async function uploadDocument(
  config: DeeplConfig,
  file: { bytes: Uint8Array; filename: string },
  locale: SupportedLocale,
) {
  const form = new FormData();
  form.append("file", new Blob([Buffer.from(file.bytes)], { type: "application/pdf" }), file.filename);
  form.append("target_lang", deeplTarget(locale));
  const json = (await (await call(config, "/v2/document", form)).json()) as { document_id: string; document_key: string };
  return { documentId: json.document_id, documentKey: json.document_key };
}

export type DeeplStatus = {
  status: "queued" | "translating" | "done" | "error";
  secondsRemaining: number | null;
  billedCharacters: number | null;
  error: string | null;
};

export async function documentStatus(config: DeeplConfig, documentId: string, documentKey: string): Promise<DeeplStatus> {
  const response = await call(config, `/v2/document/${documentId}`, new URLSearchParams({ document_key: documentKey }));
  const json = (await response.json()) as {
    status: DeeplStatus["status"];
    seconds_remaining?: number;
    billed_characters?: number;
    error_message?: string;
    message?: string;
  };
  return {
    status: json.status,
    secondsRemaining: json.seconds_remaining ?? null,
    billedCharacters: json.billed_characters ?? null,
    error: json.error_message ?? json.message ?? null,
  };
}

/** The translated file. DeepL deletes it once downloaded: store it before anything else. */
export async function downloadDocument(config: DeeplConfig, documentId: string, documentKey: string) {
  const response = await call(config, `/v2/document/${documentId}/result`, new URLSearchParams({ document_key: documentKey }));
  return new Uint8Array(await response.arrayBuffer());
}
