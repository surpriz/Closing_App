"use client";

import { Link2, Mail } from "lucide-react";
import NextLink from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createOutreachLinkAction,
  markOutreachSentAction,
  type OutreachResult,
} from "@/app/(dashboard)/prospection/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  suggestionId: string;
  documents: { id: string; name: string }[];
  hasLink: boolean;
};

type Ready = Exclude<OutreachResult, { error: string }>;

export function OutreachDialog({ suggestionId, documents, hasLink }: Props) {
  const [open, setOpen] = useState(false);
  const [documentId, setDocumentId] = useState(documents[0]?.id ?? "");
  const [result, setResult] = useState<Ready | null>(null);
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  const prepare = () =>
    startTransition(async () => {
      const outcome = await createOutreachLinkAction(suggestionId, documentId);
      if ("error" in outcome) {
        toast.error(outcome.error);
        return;
      }
      setResult(outcome);
      setBody(outcome.body);
    });

  const markSent = (linkId: string) =>
    startTransition(async () => {
      const outcome = await markOutreachSentAction(linkId);
      if ("error" in outcome) toast.error(outcome.error);
      else {
        toast.success("C'est parti : le deal apparaît dans votre journée");
        setResult((current) => current && { ...current, draft: false });
        setOpen(false);
      }
    });

  const mailto = result
    ? `mailto:${result.email}?subject=${encodeURIComponent(result.subject)}&body=${encodeURIComponent(body)}`
    : "#";
  // Some mail clients cut longer mailto links: copy and paste then
  const mailtoFits = mailto.length <= 2000;

  const copy = () =>
    navigator.clipboard
      .writeText(body)
      .then(() => toast.success("Message copié"))
      .catch(() => toast.error("Copie impossible : sélectionnez le texte à la main."));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Link2 aria-hidden />
        {hasLink ? "Voir le message" : "Créer un lien"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Premier message</DialogTitle>
          <DialogDescription>
            Vous l&apos;envoyez depuis votre boîte mail. Clozer ne relance pas tout seul un contact qui ne vous connaît pas.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-3">
            {documents.length === 0 ? (
              <p className="text-small text-muted-foreground">
                Ajoutez d&apos;abord un document dans <NextLink href="/documents" className="underline">Documents</NextLink>.
              </p>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor={`doc-${suggestionId}`}>Document à partager</Label>
                <select
                  id={`doc-${suggestionId}`}
                  value={documentId}
                  onChange={(event) => setDocumentId(event.target.value)}
                  disabled={hasLink}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
                >
                  {documents.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <Button onClick={prepare} disabled={pending || (!hasLink && !documentId)}>
              {pending ? "Rédaction…" : hasLink ? "Afficher le message" : "Créer le lien et rédiger"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-small">
              <span className="text-muted-foreground">À :</span> {result.email}
              <br />
              <span className="text-muted-foreground">Objet :</span> {result.subject}
            </p>
            <Textarea
              aria-label="Message à envoyer"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={12}
            />
            <DialogFooter>
              <Button variant="outline" onClick={copy}>
                Copier le message
              </Button>
              {mailtoFits && (
                <Button variant="outline" render={<a href={mailto} />} nativeButton={false}>
                  <Mail aria-hidden />
                  Ouvrir dans ma messagerie
                </Button>
              )}
              {result.draft && (
                <Button disabled={pending} onClick={() => markSent(result.linkId)}>
                  Je l&apos;ai envoyé
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
