"use client";

import { Check, Copy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { markLinkCopied, markLinkNotSent, markLinkSent } from "@/app/(dashboard)/links/actions";
import { Button, buttonVariants } from "@/components/ui/button";

export type ReadyLink = {
  id: string;
  url: string;
  /** Who it is for, or "Sans destinataire". */
  label: string;
  documentName: string;
  /** Copied a while ago and still never opened: ask whether it really went out. */
  askIfSent: boolean;
  copied: boolean;
};

/**
 * Links made when a file was dropped and not sent yet, one row each. Copying is not sending:
 * a copied link waits for its first opening, and after a while the seller is asked whether it went out.
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
      setTimeout(() => setCopied(false), 2000);
      toast.success("Lien copié. Collez-le dans votre message.");
      startTransition(async () => {
        await markLinkCopied(link.id);
        router.refresh();
      });
    } catch {
      toast.error("Copie impossible : ouvrez le lien pour le copier à la main.");
    }
  }

  function answer(sent: boolean) {
    startTransition(async () => {
      await (sent ? markLinkSent(link.id) : markLinkNotSent(link.id));
      router.refresh();
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 px-3 py-4 sm:px-4">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{link.documentName}</p>
        <p className="truncate text-small text-muted-foreground">
          Pour : <span className="text-foreground">{link.label}</span>
          {" · "}
          {link.copied ? "copié, pas encore ouvert" : "prêt, pas encore envoyé"}
        </p>
      </div>
      {link.askIfSent ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-small font-medium">Avez-vous envoyé ce lien ?</span>
          <Button size="sm" disabled={pending} onClick={() => answer(true)}>
            Oui, envoyé
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => answer(false)}>
            Pas encore
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={pending} onClick={() => void copy()}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copié" : "Copier le lien"}
          </Button>
          <Link href={`/links/${link.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
            Pour qui, réglages
          </Link>
        </div>
      )}
    </li>
  );
}
