"use client";

import { ArrowRight, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { promoteReader } from "@/app/(dashboard)/links/actions";
import { Button } from "@/components/ui/button";

export type SharedReader = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  /** "lu il y a 2 h", computed on the server. */
  seen: string | null;
  /** Their personal link, once the seller made one. */
  personalLinkId: string | null;
};

/**
 * Who opened a shared link. Each one gave their email at the door; the
 * interesting ones get a personal link, which is where a deal starts.
 */
export function SharedReaders({ linkId, readers, canEdit }: { linkId: string; readers: SharedReader[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function promote(readerId: string) {
    startTransition(async () => {
      const result = await promoteReader(linkId, readerId);
      if ("error" in result) return void toast.error(result.error);
      router.push(`/links/${result.linkId}?new=1`);
    });
  }

  if (readers.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-muted-foreground">
        Personne pour l&apos;instant. Chaque lecteur apparaîtra ici avec son email.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {readers.map((reader) => (
        <li key={reader.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="min-w-0 text-sm">
            <span className="block truncate font-medium">{reader.name ?? reader.email}</span>
            <span className="block truncate text-muted-foreground">
              {[reader.name ? reader.email : null, reader.company, reader.seen].filter(Boolean).join(" · ")}
            </span>
          </span>
          {reader.personalLinkId ? (
            <Button size="xs" variant="ghost" render={<Link href={`/links/${reader.personalLinkId}`} />} nativeButton={false}>
              Son lien <ArrowRight />
            </Button>
          ) : (
            canEdit && (
              <Button size="xs" variant="outline" disabled={pending} onClick={() => promote(reader.id)}>
                <UserPlus /> Créer son lien
              </Button>
            )
          )}
        </li>
      ))}
    </ul>
  );
}
