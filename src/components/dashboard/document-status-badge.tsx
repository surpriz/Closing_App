import { Badge } from "@/components/ui/badge";
import type { DocumentStatus } from "@/generated/prisma/enums";

const LABELS: Record<DocumentStatus, string> = {
  UPLOADED: "Importé",
  PROCESSING: "Analyse…",
  READY: "Prêt",
  FAILED: "Échec",
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const variant =
    status === "READY" ? "secondary" : status === "FAILED" ? "destructive" : "outline";
  return <Badge variant={variant}>{LABELS[status]}</Badge>;
}
