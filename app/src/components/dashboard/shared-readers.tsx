import { ArrowRight, ChevronRight, Phone } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export type SharedReader = {
  /** Their own link, made when they gave their email. */
  linkId: string;
  label: string;
  detail: string;
  /** "Chaud", "Validé", "Ouvert"… */
  state: string;
  /** Stayed past the pricing threshold: the ones to call. */
  hot: boolean;
  /** "2 min 10 s sur le tarif", "40 s de lecture". */
  time: string | null;
};

/** Past this many, the readers who did not stay fold away. */
const OPEN_LIST_MAX = 8;

/**
 * Who opened a shared link: each one has their own link, a deal like any
 * other. The few who stayed come first, to call before the rest.
 */
export function SharedReaders({ readers }: { readers: SharedReader[] }) {
  const t = useTranslations("deal.sharedReaders");
  if (readers.length === 0) {
    return (
      <p className="py-3 text-small text-muted-foreground">
        {t("empty")}
      </p>
    );
  }

  const hot = readers.filter((reader) => reader.hot);
  const others = readers.filter((reader) => !reader.hot);
  const fold = hot.length > 0 && others.length > OPEN_LIST_MAX;

  return (
    <div className="divide-y divide-border">
      {hot.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 pt-3 text-small font-semibold">
            <Phone className="size-3.5" aria-hidden />
            {t("callNow")}
          </p>
          <ReaderList readers={hot} />
        </div>
      )}
      {fold ? (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 py-3 text-small text-muted-foreground hover:text-foreground">
            <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
            {t("others", { count: others.length })}
          </summary>
          <ReaderList readers={others} />
        </details>
      ) : (
        others.length > 0 && <ReaderList readers={others} />
      )}
    </div>
  );
}

function ReaderList({ readers }: { readers: SharedReader[] }) {
  return (
    <ul className="divide-y divide-border">
      {readers.map((reader) => (
        <li key={reader.linkId}>
          <Link
            href={`/links/${reader.linkId}`}
            className="-mx-2 flex items-center justify-between gap-3 px-2 py-3 transition-colors hover:bg-muted/60"
          >
            <span className="min-w-0 text-body">
              <span className="block truncate font-medium">{reader.label}</span>
              <span className="block truncate text-small text-muted-foreground">
                {[reader.time, reader.detail].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-small text-muted-foreground">
              {reader.state}
              <ArrowRight className="size-4" aria-hidden />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
