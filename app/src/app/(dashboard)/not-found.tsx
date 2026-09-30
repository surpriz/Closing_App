import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <EmptyState
      title="Cette page n'existe plus."
      description="Le document ou le lien a peut-être été archivé."
      action={
        <Link href="/documents" className={buttonVariants({ variant: "outline" })}>
          Retour aux documents
        </Link>
      }
    />
  );
}
