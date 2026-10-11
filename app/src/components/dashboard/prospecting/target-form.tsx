"use client";

import { Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deduceTargetAction, saveTargetAction } from "@/app/(dashboard)/prospection/actions";
import { FormCheckbox } from "@/components/dashboard/form-checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { REGIONS } from "@/lib/prospecting/geo";
import { formatHeadcountRange, HEADCOUNT_BRACKETS } from "@/lib/prospecting/headcount";
import { nafLabel } from "@/lib/prospecting/naf";
import { SENIORITIES, SENIORITY_LABELS, type TargetFilters } from "@/lib/prospecting/target";

type Evidence = { domains: number; recognized: number; won: number; averageConfidence: number | null };

type Props = {
  initial: TargetFilters;
  origin: "MANUAL" | "INFERRED" | null;
};

function confidenceWord(value: number | null) {
  if (value === null) return null;
  if (value >= 0.8) return "bonne";
  if (value >= 0.6) return "moyenne";
  return "faible";
}

export function TargetForm({ initial, origin }: Props) {
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
      else toast.success("Cible enregistrée");
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

  const confidence = confidenceWord(evidence?.averageConfidence ?? null);

  return (
    <form onSubmit={save} className="space-y-6">
      <input type="hidden" name="origin" value={evidence ? "INFERRED" : (origin ?? "MANUAL")} />
      <input type="hidden" name="evidence" value={evidence ? JSON.stringify(evidence) : ""} />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={deduce} disabled={deducing}>
          <Sparkles aria-hidden />
          {deducing ? "Analyse de vos deals…" : "Déduire de mes deals"}
        </Button>
        {evidence && (
          <p className="text-small text-muted-foreground">
            Proposé à partir de {evidence.recognized} entreprise{evidence.recognized > 1 ? "s" : ""} reconnue
            {evidence.recognized > 1 ? "s" : ""} sur {evidence.domains}
            {evidence.won > 0 && `, dont ${evidence.won} gagnée${evidence.won > 1 ? "s" : ""}`}
            {confidence && ` · confiance ${confidence}`}. Vérifiez puis enregistrez.
          </p>
        )}
      </div>

      <div key={version} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="keywords">Secteur, en vos mots</Label>
            <Input id="keywords" name="keywords" defaultValue={filters.keywords.join(", ")} placeholder="agence web, studio de design" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nafCodes">Codes NAF</Label>
            <Input id="nafCodes" name="nafCodes" defaultValue={filters.nafCodes.join(", ")} placeholder="62.01Z, 73.11Z" />
            {filters.nafCodes.length > 0 && (
              <p className="text-small text-muted-foreground">
                {[...new Set(filters.nafCodes.map((code) => nafLabel(code)).filter(Boolean))].join(" · ")}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jobTitles">Postes visés</Label>
            <Input id="jobTitles" name="jobTitles" defaultValue={filters.jobTitles.join(", ")} placeholder="Directeur commercial, CEO" />
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Niveau</legend>
            <div className="grid grid-cols-2 gap-2">
              {SENIORITIES.map((seniority) => (
                <FormCheckbox
                  key={seniority}
                  name="seniorities"
                  value={seniority}
                  label={SENIORITY_LABELS[seniority]}
                  defaultChecked={filters.seniorities.includes(seniority)}
                />
              ))}
            </div>
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="excludedDomains">Domaines à exclure</Label>
            <Input
              id="excludedDomains"
              name="excludedDomains"
              defaultValue={filters.excludedDomains.join(", ")}
              placeholder="client-actuel.fr"
            />
          </div>
        </div>

        <div className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Effectif</legend>
            <div className="grid grid-cols-2 gap-2">
              {HEADCOUNT_BRACKETS.map((bracket) => (
                <FormCheckbox
                  key={bracket.code}
                  name="headcountCodes"
                  value={bracket.code}
                  label={formatHeadcountRange(bracket)}
                  defaultChecked={filters.headcountCodes.includes(bracket.code)}
                />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Régions</legend>
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
            <Label htmlFor="departements">Départements</Label>
            <Input id="departements" name="departements" defaultValue={filters.departements.join(", ")} placeholder="69, 38" />
          </div>
        </div>
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? "Enregistrement…" : "Enregistrer la cible"}
      </Button>
    </form>
  );
}
