import { Badge } from "@/components/ui/badge";
import type { Person, ReaderMap } from "@/lib/closing/committee/reader-map";
import { isDecisionRole } from "@/lib/closing/committee/roles";
import { formatDuration, formatRelative } from "@/lib/format";

import { LiveDot } from "./heat";
import { READER_ORIGIN_LABELS, PROSPECT_ROLE_LABELS } from "./labels";
import { Surface } from "./page-header";
import { ProspectRoleSelect } from "./prospect-role-select";

/**
 * "Qui lit": the people who opened the proposal, grouped by company or network,
 * with who was passed the link and who holds the budget.
 */
export function ReadersMap({ linkId, map, now }: { linkId: string; map: ReaderMap; now: Date }) {
  if (map.persons.length === 0) {
    return (
      <Surface className="px-4 py-3">
        <p className="text-sm text-muted-foreground">Personne n&apos;a encore ouvert la proposition.</p>
      </Surface>
    );
  }

  return (
    <Surface>
      <div className="divide-y divide-border">
        {map.groups.map((group) => (
          <div key={group.key} className="px-4 py-3">
            <p className="mb-2 flex items-baseline justify-between gap-2 text-small text-muted-foreground">
              <span className="truncate font-medium text-foreground">{group.label}</span>
              <span className="tabular-nums">
                {group.persons.length} {group.persons.length === 1 ? "lecteur" : "lecteurs"}
              </span>
            </p>
            <ul className="space-y-3">
              {group.persons.map((person) => (
                <PersonRow key={person.key} linkId={linkId} person={person} now={now} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Surface>
  );
}

function PersonRow({ linkId, person, now }: { linkId: string; person: Person; now: Date }) {
  const decision = isDecisionRole(person.role?.role);
  return (
    <li className="space-y-1.5 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        {person.readingNow && <LiveDot className="shrink-0" />}
        <span className="truncate font-medium">{person.label}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {decision && person.role && (
          <Badge variant="hot" title={person.role.source === "seller" ? "Tagué par vous" : "Détecté depuis l'email"}>
            Décideur{person.role.source === "detected" ? " (détecté)" : ""}
          </Badge>
        )}
        {!decision && person.role && person.role.role !== "OTHER" && <Badge variant="secondary">{PROSPECT_ROLE_LABELS[person.role.role]}</Badge>}
        <Badge variant={person.origin === "forwarded_internal" ? "warning" : "outline"}>{READER_ORIGIN_LABELS[person.origin]}</Badge>
        {person.viaNetwork && <span className="text-small text-muted-foreground">même réseau</span>}
      </div>
      <p className="text-small text-muted-foreground">
        1re lecture {formatRelative(person.firstReadAt, now)} · dernière {person.readingNow ? "en ce moment" : formatRelative(person.lastReadAt, now)} ·{" "}
        {formatDuration(person.totalDurationMs)}
      </p>
      {person.prospectId && (
        <ProspectRoleSelect
          linkId={linkId}
          prospectId={person.prospectId}
          role={person.role?.source === "seller" ? person.role.role : null}
          detected={person.detectedRole}
        />
      )}
    </li>
  );
}
