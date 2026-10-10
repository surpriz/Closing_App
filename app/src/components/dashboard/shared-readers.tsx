import { ArrowRight } from "lucide-react";
import Link from "next/link";

export type SharedReader = {
  /** Their own link, made when they gave their email. */
  linkId: string;
  label: string;
  detail: string;
  /** "Chaud", "Validé", "Ouvert"… */
  state: string;
};

/** Who opened a shared link: each one has their own link, a deal like any other. */
export function SharedReaders({ readers }: { readers: SharedReader[] }) {
  if (readers.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-muted-foreground">
        Personne pour l&apos;instant. Chaque lecteur apparaîtra ici avec son propre suivi.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {readers.map((reader) => (
        <li key={reader.linkId}>
          <Link
            href={`/links/${reader.linkId}`}
            className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
          >
            <span className="min-w-0 text-sm">
              <span className="block truncate font-medium">{reader.label}</span>
              <span className="block truncate text-muted-foreground">{reader.detail}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
              {reader.state}
              <ArrowRight className="size-4" aria-hidden />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
