import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import type { DocumentStatus } from "@/generated/prisma/enums";

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const t = useTranslations("documents.status");
  const variant =
    status === "READY" ? "secondary" : status === "FAILED" ? "destructive" : "outline";
  return <Badge variant={variant}>{t(status)}</Badge>;
}
