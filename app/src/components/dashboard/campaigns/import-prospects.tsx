"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { importProspectsAction } from "@/app/(dashboard)/campaigns/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, PROSPECT_COLUMNS, sampleCsv } from "@/lib/outreach/csv";
import type { ImportSummary } from "@/lib/outreach/enroll";

const MAX_LISTED_REJECTIONS = 20;

/** Excel's plain "CSV" export is Windows-1252, not UTF-8: read as UTF-8 first, fall back when the bytes refuse. */
async function readAsText(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export function ImportProspects({ campaignId }: { campaignId: string }) {
  const t = useTranslations("campaigns.import");
  const locale = useLocale();
  const [csv, setCsv] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const columns = PROSPECT_COLUMNS.map((column) => t(`columnNames.${column}`)).join(", ");

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (file.size > MAX_IMPORT_BYTES) {
      setError(t("errors.tooBig"));
      return;
    }
    try {
      setCsv(await readAsText(file));
    } catch {
      setError(t("errors.read"));
    }
  };

  const submit = () => {
    if (new Blob([csv]).size > MAX_IMPORT_BYTES) {
      setError(t("errors.tooBig"));
      return;
    }
    setError(null);
    setSummary(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("csv", csv);
      // A rejected action (body too large, network) must not reach the error boundary
      const result = await importProspectsAction(campaignId, formData).catch(() => ({ error: t("errors.failed") }));
      if ("error" in result) {
        toast.error(result.error);
        setError(result.error);
        return;
      }
      setSummary(result);
      if (!result.tooMany) {
        setCsv("");
        if (fileRef.current) fileRef.current.value = "";
        toast.success(t("result.enrolled", { count: result.enrolled }));
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="campaign-csv" className="text-small font-medium">
          {t("paste")}
        </label>
        <Textarea
          id="campaign-csv"
          aria-label={t("pasteLabel")}
          value={csv}
          onChange={(event) => setCsv(event.target.value)}
          rows={6}
          spellCheck={false}
          className="font-mono"
          placeholder="email,firstName,company"
        />
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt"
          aria-label={t("file")}
          onChange={(event) => onFile(event.target.files?.[0])}
          className="block text-small text-muted-foreground file:mr-3 file:border file:border-input file:bg-card file:px-2.5 file:py-1 file:text-small file:text-foreground"
        />
      </div>

      <ul className="space-y-0.5 text-small text-muted-foreground">
        <li>
          {t("sample")}{" "}
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(sampleCsv(locale))}`}
            download={t("sampleFile")}
            className="underline underline-offset-2 hover:text-foreground"
          >
            {t("sampleLink")}
          </a>
        </li>
        <li>{t("columns", { columns })}</li>
        <li>{t("limit", { max: MAX_IMPORT_ROWS })}</li>
        <li>{t("personal")}</li>
      </ul>

      {error && (
        <p role="alert" className="text-small text-destructive">
          {error}
        </p>
      )}

      <Button onClick={submit} disabled={pending || !csv.trim()}>
        {pending ? t("importing") : t("submit")}
      </Button>

      {summary && <ImportResult summary={summary} />}
    </div>
  );
}

function ImportResult({ summary }: { summary: ImportSummary }) {
  const t = useTranslations("campaigns.import");
  const mapping = Object.entries(summary.mapping) as [(typeof PROSPECT_COLUMNS)[number], string][];
  const counts = [
    { key: "enrolled", count: summary.enrolled },
    { key: "duplicates", count: summary.duplicates },
    { key: "suppressed", count: summary.suppressed },
    { key: "team", count: summary.team },
    { key: "elsewhere", count: summary.elsewhere },
    { key: "personal", count: summary.personal },
    { key: "missingVariables", count: summary.missingVariables },
  ] as const;

  return (
    <div role="status" className="space-y-3 border-l-2 border-foreground pl-4 text-small">
      <h3 className="text-body font-semibold">{t("result.title")}</h3>
      {summary.tooMany ? (
        <p className="text-destructive">{t("result.tooMany", { max: MAX_IMPORT_ROWS })}</p>
      ) : (
        <ul className="space-y-0.5">
          {counts
            .filter(({ key, count }) => count > 0 || key === "enrolled")
            .map(({ key, count }) => (
              <li key={key}>{t(`result.${key}`, { count })}</li>
            ))}
        </ul>
      )}

      <div className="space-y-0.5">
        <p className="font-medium">{t("result.mapping")}</p>
        {mapping.length ? (
          <ul className="text-muted-foreground">
            {mapping.map(([column, header]) => (
              <li key={column}>
                {t(`columnNames.${column}`)} ← <span className="font-mono">{header}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">{t("result.noMapping")}</p>
        )}
      </div>

      {summary.rejected.length > 0 && (
        <div className="space-y-0.5">
          <p className="font-medium">{t("result.rejected", { count: summary.rejected.length })}</p>
          <ul className="text-muted-foreground">
            {summary.rejected.slice(0, MAX_LISTED_REJECTIONS).map((row) => (
              <li key={row.line}>
                {t("result.line", {
                  line: row.line,
                  reason: row.reason === "no_email" ? t("result.reasonNoEmail") : t("result.reasonInvalidEmail"),
                })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
