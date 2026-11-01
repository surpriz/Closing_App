"use client";

import { Check, Copy } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  discardDraftLink,
  markLinkCopied,
  restoreDraftLink,
  markLinkNotSent,
  markLinkSent,
} from "@/app/(dashboard)/links/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { copyLink } from "@/lib/clipboard";
import { formatRelative } from "@/lib/format";

export type ReadyLink = {
  id: string;
  url: string;
  /** What the prospect clicks on once pasted in an email. */
  title: string;
  /** Who it is for, or "Sans destinataire" (today.page.noRecipient). */
  label: string;
  documentName: string;
  /** When the drop created it: a link waiting for days reads differently from one made a minute ago. */
  createdAt: Date;
};

/**
 * Links made when a file was dropped and never copied, grouped by document: two drops of the same
 * file read as one document with two links, not two identical rows. Copying takes a row away: the
 * link then waits for its first opening under "À traiter", like any sent link.
 */
export function ReadyLinks({ links }: { links: ReadyLink[] }) {
  const t = useTranslations("today.readyLinks");
  const groups = new Map<string, ReadyLink[]>();
  for (const link of links) groups.set(link.documentName, [...(groups.get(link.documentName) ?? []), link]);

  return (
    <div className="divide-y divide-foreground border-y border-foreground bg-card">
      {[...groups].map(([documentName, group]) => (
        <section key={documentName} className="px-3 py-3 sm:px-4">
          <h3 className="flex flex-wrap items-baseline gap-x-2 text-body font-semibold">
            <span className="truncate">{documentName}</span>
            {group.length > 1 && (
              <span className="text-small font-normal text-muted-foreground">{t("group", { count: group.length })}</span>
            )}
          </h3>
          <ul className="divide-y divide-border">
            {group.map((link) => (
              <ReadyLinkRow key={link.id} link={link} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ReadyLinkRow({ link }: { link: ReadyLink }) {
  const router = useRouter();
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const t = useTranslations("today.readyLinks");

  async function copy() {
    try {
      await copyLink(link);
      setCopied(true);
      toast.success(t("copiedToast"));
      startTransition(async () => {
        await markLinkCopied(link.id);
        router.refresh();
      });
    } catch {
      toast.error(t("copyError"));
    }
  }

  // No confirmation: removing is one click, and so is taking it back
  function discard() {
    startTransition(async () => {
      await discardDraftLink(link.id);
      router.refresh();
      toast(t("removed"), {
        action: {
          label: t("undo"),
          onClick: () =>
            void restoreDraftLink(link.id).then(
              () => router.refresh(),
              () => toast.error(t("undoFailed")),
            ),
        },
      });
    });
  }

  return (
    // On a phone the name takes the full width and the buttons sit under it
    <li className="flex flex-col gap-x-4 gap-y-2 py-3 sm:flex-row sm:items-center">
      <p className="min-w-0 flex-1 truncate text-small text-muted-foreground">
        {t.rich("for", {
          label: link.label,
          who: (chunks) => <span className="text-foreground">{chunks}</span>,
        })}
        {" · "}
        {t("createdAgo", { when: formatRelative(link.createdAt, locale) })}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={pending} onClick={() => void copy()}>
          {copied ? <Check /> : <Copy />}
          {copied ? t("copied") : t("copyLink")}
        </Button>
        {/* The recipient field is the first thing on the share screen */}
        <Link
          href={`/links/${link.id}?new=1`}
          className={buttonVariants({ size: "sm", variant: "outline" })}
        >
          {t("forWhom")}
        </Link>
        <Button size="sm" variant="ghost" disabled={pending} onClick={discard}>
          {t("remove")}
        </Button>
      </div>
    </li>
  );
}

/** Copied two days ago and still never opened: only the seller knows whether it really went out. */
export function SentQuestion({ linkId }: { linkId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const t = useTranslations("today.readyLinks");

  function answer(sent: boolean) {
    startTransition(async () => {
      await (sent ? markLinkSent(linkId) : markLinkNotSent(linkId));
      router.refresh();
    });
  }

  return (
    <span className="relative z-10 flex flex-wrap items-center gap-2">
      <span className="text-small font-medium">
        {t("sentQuestion")}
      </span>
      <Button size="xs" disabled={pending} onClick={() => answer(true)}>
        {t("yes")}
      </Button>
      <Button
        size="xs"
        variant="outline"
        disabled={pending}
        onClick={() => answer(false)}
      >
        {t("notYet")}
      </Button>
    </span>
  );
}
