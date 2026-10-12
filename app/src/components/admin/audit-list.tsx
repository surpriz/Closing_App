import Link from "next/link";

import type { AuditEntry } from "@/lib/admin/audit";
import { ADMIN_ACTION_LABELS, adminDateTime, type AdminAction } from "@/lib/admin/format";

const TARGET_PATHS: Record<string, string> = { user: "/admin/users", organization: "/admin/workspaces" };

function actionLabel(action: string) {
  return ADMIN_ACTION_LABELS[action as AdminAction] ?? action;
}

/** Admin journal lines; `showTarget` links each line to what it touched. */
export function AuditList({ entries, showTarget = false }: { entries: AuditEntry[]; showTarget?: boolean }) {
  if (entries.length === 0) return <p className="px-5 py-4 text-sm text-muted-foreground">Aucune action pour l&apos;instant.</p>;

  return (
    <ul className="divide-y divide-border">
      {entries.map((entry) => {
        const targetPath = entry.targetId && TARGET_PATHS[entry.targetType];
        return (
          <li key={entry.id} className="space-y-0.5 px-5 py-3 text-sm">
            <p>
              <span className="font-medium">{actionLabel(entry.action)}</span>
              {showTarget && targetPath && (
                <>
                  {" · "}
                  <Link href={`${targetPath}/${entry.targetId}`} className="text-muted-foreground hover:underline">
                    voir la cible
                  </Link>
                </>
              )}
            </p>
            {entry.reason && <p className="text-muted-foreground">« {entry.reason} »</p>}
            <p className="text-small text-muted-foreground">
              {adminDateTime.format(entry.createdAt)} · {entry.actorEmail ?? "admin supprimé"}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
