import { ChevronRight, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { Person, ReaderGroup, ReaderMap } from "@/lib/closing/committee/reader-map";
import { isDecisionRole } from "@/lib/closing/committee/roles";
import { formatDuration, formatRelative } from "@/lib/format";

import { LiveDot } from "./heat";
import { PROSPECT_ROLE_LABELS, READER_ORIGIN_LABELS } from "./labels";
import { Surface } from "./page-header";
import { ProspectForm } from "./prospect-form";
import { ProspectRoleSelect } from "./prospect-role-select";

export type PanelProspect = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  phoneE164: string | null;
  whatsappOptInAt: Date | null;
  unsubscribedAt: Date | null;
};

const GROUP_LABELS: Record<Exclude<ReaderGroup["kind"], "domain">, string> = {
  network: "Même réseau, sans email",
  personal: "Adresses personnelles",
  unknown: "Sans email",
};

/**
 * "Prospect": the contacts who get the follow-ups, each with what they read,
 * then the other people who opened the link. One card instead of two.
 */
export function ProspectPanel({
  linkId,
  prospects,
  map,
  now,
}: {
  linkId: string;
  prospects: PanelProspect[];
  map: ReaderMap;
  now: Date;
}) {
  const personByProspect = new Map(map.persons.filter((p) => p.prospectId).map((p) => [p.prospectId!, p]));
  const others = map.groups
    .map((group) => ({ ...group, persons: group.persons.filter((p) => !p.prospectId || !prospects.some((c) => c.id === p.prospectId)) }))
    .filter((group) => group.persons.length > 0);

  return (
    <Surface>
      <div className="divide-y divide-border">
        {prospects.map((prospect) => {
          const person = personByProspect.get(prospect.id);
          return (
            <details key={prospect.id} className="group px-4 py-3">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 outline-none focus-visible:underline [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 space-y-1 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    {person?.readingNow && <LiveDot className="shrink-0" />}
                    <span className="truncate font-medium">{prospect.name ?? prospect.email}</span>
                    {prospect.unsubscribedAt && <span className="shrink-0 text-destructive">désinscrit</span>}
                  </span>
                  <span className="block truncate text-muted-foreground">
                    {[prospect.name ? prospect.email : null, prospect.phoneE164, prospect.whatsappOptInAt ? "WhatsApp accepté" : null]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                  {person ? <ReadingFacts person={person} now={now} /> : <span className="block text-muted-foreground">Pas encore lu.</span>}
                </span>
                <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
              </summary>
              <div className="space-y-3">
                {person && (
                  <div className="mt-2">
                    <ProspectRoleSelect
                      linkId={linkId}
                      prospectId={prospect.id}
                      role={person.role?.source === "seller" ? person.role.role : null}
                      detected={person.detectedRole}
                    />
                  </div>
                )}
                <ProspectForm
                  linkId={linkId}
                  prospect={{
                    id: prospect.id,
                    email: prospect.email,
                    name: prospect.name,
                    company: prospect.company,
                    phoneE164: prospect.phoneE164,
                    whatsappOptIn: !!prospect.whatsappOptInAt,
                  }}
                />
              </div>
            </details>
          );
        })}
        <details className="group px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium outline-none focus-visible:underline [&::-webkit-details-marker]:hidden">
            <Plus className="size-4" /> Ajouter un contact
          </summary>
          <ProspectForm linkId={linkId} />
        </details>
        {others.length > 0 && (
          <div id="qui-lit" className="scroll-mt-20 px-4 py-3">
            <p className="mb-2 text-sm font-medium">Autres lecteurs</p>
            <div className="space-y-3">
              {others.map((group) => (
                <div key={group.key}>
                  <p className="mb-1.5 text-small text-muted-foreground">
                    {group.kind === "domain" ? group.label : GROUP_LABELS[group.kind]}
                  </p>
                  <ul className="space-y-2.5">
                    {group.persons.map((person) => (
                      <li key={person.key} className="space-y-1 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          {person.readingNow && <LiveDot className="shrink-0" />}
                          <span className="truncate font-medium">{person.label}</span>
                        </span>
                        <ReadingFacts person={person} now={now} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Surface>
  );
}

function ReadingFacts({ person, now }: { person: Person; now: Date }) {
  const decision = isDecisionRole(person.role?.role);
  return (
    <span className="block space-y-1">
      <span className="block text-small text-muted-foreground">
        1re lecture {formatRelative(person.firstReadAt, now)} · dernière{" "}
        {person.readingNow ? "en ce moment" : formatRelative(person.lastReadAt, now)} · {formatDuration(person.totalDurationMs)}
      </span>
      {(decision || (person.role && person.role.role !== "OTHER") || person.origin !== "initial" || person.viaNetwork) && (
        <span className="flex flex-wrap items-center gap-1.5">
          {decision && person.role && (
            <Badge variant="hot" title={person.role.source === "seller" ? "Tagué par vous" : "Deviné depuis l'email"}>
              Décideur{person.role.source === "detected" ? " (deviné)" : ""}
            </Badge>
          )}
          {!decision && person.role && person.role.role !== "OTHER" && (
            <Badge variant="secondary">{PROSPECT_ROLE_LABELS[person.role.role]}</Badge>
          )}
          {person.origin !== "initial" && (
            <Badge variant={person.origin === "forwarded_internal" ? "warning" : "outline"}>{READER_ORIGIN_LABELS[person.origin]}</Badge>
          )}
          {person.viaNetwork && <span className="text-small text-muted-foreground">même réseau</span>}
        </span>
      )}
    </span>
  );
}
