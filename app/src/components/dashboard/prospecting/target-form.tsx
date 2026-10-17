"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deduceTargetAction, saveTargetAction } from "@/app/(dashboard)/prospecting/actions";
import { FormCheckbox } from "@/components/dashboard/form-checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { REGIONS } from "@/lib/prospecting/geo";
import { HEADCOUNT_BRACKETS } from "@/lib/prospecting/headcount";
import { nafLabel } from "@/lib/prospecting/naf";
import { SENIORITIES, type TargetFilters } from "@/lib/prospecting/target";

type Evidence = { domains: number; recognized: number; won: number; averageConfidence: number | null };

type Props = {
  initial: TargetFilters;
  origin: "MANUAL" | "INFERRED" | null;
};

function confidenceLevel(value: number | null) {
  if (value === null) return null;
  if (value >= 0.8) return "good";
  if (value >= 0.6) return "medium";
  return "low";
}

export function TargetForm({ initial, origin }: Props) {
  const t = useTranslations("prospecting.targetForm");
  const [filters, setFilters] = useState(initial);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [version, setVersion] = useState(0);
  const [deducing, startDeduce] = useTransition();
  const [saving, startSave] = useTransition();

  // Submitted by hand, not as a form action: React would reset the fields after an error
  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startSave(async () => {
      const result = await saveTargetAction(formData);
      // On success the page keys this form by the new target: it remounts without the evidence
      if ("error" in result) toast.error(result.error);
      else toast.success(t("saved"));
    });
  };

  const deduce = () =>
    startDeduce(async () => {
      const result = await deduceTargetAction();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setFilters(result.filters);
      setEvidence(result.evidence);
      setVersion((v) => v + 1);
    });

  const confidence = confidenceLevel(evidence?.averageConfidence ?? null);

  return (
    <form onSubmit={save} className="space-y-6">
      <input type="hidden" name="origin" value={evidence ? "INFERRED" : (origin ?? "MANUAL")} />
      <input type="hidden" name="evidence" value={evidence ? JSON.stringify(evidence) : ""} />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={deduce} disabled={deducing}>
          <Sparkles aria-hidden />
          {deducing ? t("deducing") : t("deduce")}
        </Button>
        {evidence && (
          <p className="text-small text-muted-foreground">
            {t("evidence", { recognized: evidence.recognized, domains: evidence.domains })}
            {evidence.won > 0 && t("evidenceWon", { won: evidence.won })}
            {confidence && t("evidenceConfidence", { level: confidence })}
            {t("evidenceEnd")}
          </p>
        )}
      </div>

      <div key={version} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="keywords">{t("keywordsLabel")}</Label>
            <Input id="keywords" name="keywords" defaultValue={filters.keywords.join(", ")} placeholder={t("keywordsPlaceholder")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nafCodes">{t("nafLabel")}</Label>
            <Input id="nafCodes" name="nafCodes" defaultValue={filters.nafCodes.join(", ")} placeholder="62.01Z, 73.11Z" />
            {filters.nafCodes.length > 0 && (
              <p className="text-small text-muted-foreground">
                {[...new Set(filters.nafCodes.map((code) => nafLabel(code)).filter(Boolean))].join(" · ")}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jobTitles">{t("jobTitlesLabel")}</Label>
            <Input id="jobTitles" name="jobTitles" defaultValue={filters.jobTitles.join(", ")} placeholder={t("jobTitlesPlaceholder")} />
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-small font-medium">{t("seniorityLegend")}</legend>
            <div className="grid grid-cols-2 gap-2">
              {SENIORITIES.map((seniority) => (
                <FormCheckbox
                  key={seniority}
                  name="seniorities"
                  value={seniority}
                  label={t(`seniority.${seniority}`)}
                  defaultChecked={filters.seniorities.includes(seniority)}
                />
              ))}
            </div>
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="excludedDomains">{t("excludedLabel")}</Label>
            <Input
              id="excludedDomains"
              name="excludedDomains"
              defaultValue={filters.excludedDomains.join(", ")}
              placeholder={t("excludedPlaceholder")}
            />
          </div>
        </div>

        <div className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-small font-medium">{t("headcountLegend")}</legend>
            <div className="grid grid-cols-2 gap-2">
              {HEADCOUNT_BRACKETS.map((bracket) => (
                <FormCheckbox
                  key={bracket.code}
                  name="headcountCodes"
                  value={bracket.code}
                  label={
                    bracket.max === null
                      ? t("headcountOpen", { min: bracket.min })
                      : t("headcountRange", { min: bracket.min, max: bracket.max })
                  }
                  defaultChecked={filters.headcountCodes.includes(bracket.code)}
                />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-small font-medium">{t("regionsLegend")}</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {Object.entries(REGIONS).map(([code, name]) => (
                <FormCheckbox
                  key={code}
                  name="regions"
                  value={code}
                  label={name}
                  defaultChecked={filters.regions.includes(code)}
                />
              ))}
            </div>
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="departements">{t("departementsLabel")}</Label>
            <Input id="departements" name="departements" defaultValue={filters.departements.join(", ")} placeholder="69, 38" />
          </div>
        </div>
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
