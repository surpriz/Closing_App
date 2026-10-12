import { Badge } from "@/components/ui/badge";
import { USER_STATUS_LABELS } from "@/lib/admin/format";
import type { UserStatus } from "@/lib/platform-admin";

const VARIANTS = { active: "success", disabled: "warning", banned: "destructive" } as const;

export function UserStatusBadge({ status }: { status: UserStatus }) {
  return <Badge variant={VARIANTS[status]}>{USER_STATUS_LABELS[status]}</Badge>;
}

export function WorkspaceStatusBadge({ suspended }: { suspended: boolean }) {
  return suspended ? <Badge variant="destructive">Suspendu</Badge> : <Badge variant="success">Actif</Badge>;
}
