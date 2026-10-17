"use client";

import { Link2, Mail } from "lucide-react";
import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createOutreachLinkAction,
  markOutreachSentAction,
  type OutreachResult,
} from "@/app/(dashboard)/prospecting/actions";
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
  const t = useTranslations("prospecting.outreach");
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
        toast.success(t("sent"));
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
      .then(() => toast.success(t("copied")))
      .catch(() => toast.error(t("copyFailed")));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Link2 aria-hidden />
        {hasLink ? t("viewMessage") : t("createLink")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-3">
            {documents.length === 0 ? (
              <p className="text-small text-muted-foreground">
                {t.rich("noDocument", {
                  link: (chunks) => (
                    <NextLink href="/documents" className="underline">
                      {chunks}
                    </NextLink>
                  ),
                })}
              </p>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor={`doc-${suggestionId}`}>{t("documentLabel")}</Label>
                <select
                  id={`doc-${suggestionId}`}
                  value={documentId}
                  onChange={(event) => setDocumentId(event.target.value)}
                  disabled={hasLink}
                  className="h-9 w-full rounded-lg border border-input bg-card px-2 text-small outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
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
              {pending ? t("drafting") : hasLink ? t("showMessage") : t("createAndDraft")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-small">
              <span className="text-muted-foreground">{t("to")}</span> {result.email}
              <br />
              <span className="text-muted-foreground">{t("subject")}</span> {result.subject}
            </p>
            <Textarea
              aria-label={t("messageLabel")}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={12}
            />
            <DialogFooter>
              <Button variant="outline" onClick={copy}>
                {t("copy")}
              </Button>
              {mailtoFits && (
                <Button variant="outline" render={<a href={mailto} />} nativeButton={false}>
                  <Mail aria-hidden />
                  {t("openMail")}
                </Button>
              )}
              {result.draft && (
                <Button disabled={pending} onClick={() => markSent(result.linkId)}>
                  {t("markSent")}
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
