import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { ADMIN_PAGE_SIZE } from "@/lib/admin/format";

/** Previous / next links that keep the current filters. */
export function AdminPagination({
  path,
  params,
  page,
  total,
}: {
  path: string;
  params: Record<string, string | undefined>;
  page: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const href = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
    if (target > 1) query.set("page", String(target));
    const search = query.toString();
    return search ? `${path}?${search}` : path;
  };

  return (
    <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
      <span>
        {total} résultat{total > 1 ? "s" : ""} · page {Math.min(page, pages)} sur {pages}
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={href(page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Précédent
          </Link>
        )}
        {page < pages && (
          <Link href={href(page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Suivant
          </Link>
        )}
      </div>
    </div>
  );
}
