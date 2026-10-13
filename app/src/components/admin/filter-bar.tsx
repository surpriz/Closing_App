import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { ADMIN_SELECT } from "./styles";

/** Page title with a GET search form: ?q= and ?statut=. */
export function AdminFilterBar({
  title,
  q,
  placeholder,
  statut,
  options,
}: {
  title: string;
  q?: string;
  placeholder: string;
  statut?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <h1 className="text-title condensed">{title}</h1>
      <form className="flex flex-wrap gap-2">
        <Input name="q" defaultValue={q} placeholder={placeholder} aria-label="Recherche" className="w-60" />
        <select name="statut" defaultValue={statut ?? ""} aria-label="Statut" className={ADMIN_SELECT}>
          <option value="">Tous</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          Filtrer
        </Button>
      </form>
    </div>
  );
}
