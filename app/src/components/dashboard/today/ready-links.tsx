"use client";

import { Check, Copy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  discardDraftLink,
  markLinkCopied,
  markLinkNotSent,
  markLinkSent,
} from "@/app/(dashboard)/links/actions";
import { Button, buttonVariants } from "@/components/ui/button";

export type ReadyLink = {
  id: string;
  url: string;
  /** Who it is for, or "Sans destinataire". */
  label: string;
  documentName: string;
};

/**
 * Links made when a file was dropped and never copied, one row each. Copying takes the row away:
 * the link then waits for its first opening under "À traiter", like any sent link.
 */
export function ReadyLinks({ links }: { links: ReadyLink[] }) {
  return (
    <ul className="divide-y divide-border border-y border-foreground bg-card">
      {links.map((link) => (
        <ReadyLinkRow key={link.id} link={link} />
      ))}
    </ul>
  );
}

function ReadyLinkRow({ link }: { link: ReadyLink }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      toast.success(
        "Lien copié. Collez-le dans votre message : vous serez prévenu dès qu'il est ouvert.",
      );
      startTransition(async () => {
        await markLinkCopied(link.id);
        router.refresh();
      });
    } catch {
      toast.error(
        "Copie impossible : ouvrez le lien pour le copier à la main.",
      );
    }
  }

  function discard() {
    startTransition(async () => {
      await discardDraftLink(link.id);
      router.refresh();
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 px-3 py-4 sm:px-4">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{link.documentName}</p>
        <p className="truncate text-small text-muted-foreground">
          Pour : <span className="text-foreground">{link.label}</span>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={pending} onClick={() => void copy()}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Copié" : "Copier le lien"}
        </Button>
        <Link
          href={`/links/${link.id}`}
          className={buttonVariants({ size: "sm", variant: "outline" })}
        >
          Pour qui
        </Link>
        <Button size="sm" variant="ghost" disabled={pending} onClick={discard}>
          Retirer
        </Button>
      </div>
    </li>
  );
}

/** Copied two days ago and still never opened: only the seller knows whether it really went out. */
export function SentQuestion({ linkId }: { linkId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function answer(sent: boolean) {
    startTransition(async () => {
      await (sent ? markLinkSent(linkId) : markLinkNotSent(linkId));
      router.refresh();
    });
  }

  return (
    <span className="relative z-10 flex flex-wrap items-center gap-2">
      <span className="text-small font-medium">
        L&apos;avez-vous bien envoyé ?
      </span>
      <Button size="xs" disabled={pending} onClick={() => answer(true)}>
        Oui
      </Button>
      <Button
        size="xs"
        variant="outline"
        disabled={pending}
        onClick={() => answer(false)}
      >
        Pas encore
      </Button>
    </span>
  );
}
