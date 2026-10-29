"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { type ActionResult, updateCampaignAction } from "@/app/(dashboard)/campaigns/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const NO_DOCUMENT = "none";

type State = ActionResult | null;

export function CampaignSettings({
  id,
  name,
  mailboxId,
  documentId,
  locale,
  linkOnReply,
  mailboxes,
  currentMailbox,
  documents,
  stepCarriesLink,
  disabled,
}: {
  id: string;
  name: string;
  mailboxId: string | null;
  documentId: string | null;
  locale: string;
  linkOnReply: boolean;
  /** ACTIVE mailboxes of the workspace: the only ones a campaign can send from. */
  mailboxes: { id: string; email: string }[];
  /** The mailbox the campaign points at today, whatever its state. */
  currentMailbox: { email: string; status: string; teammate: boolean } | null;
  documents: { id: string; title: string }[];
  /** A saved step carries the link, so a document is needed to start. */
  stepCarriesLink: boolean;
  disabled: boolean;
}) {
  const t = useTranslations("campaigns.settings");
  const selectable = mailboxes.some((mailbox) => mailbox.id === mailboxId);
  const [mailbox, setMailbox] = useState<string>(selectable && mailboxId ? mailboxId : "");
  // Controlled: a form action resets uncontrolled fields once it returns
  const [title, setTitle] = useState(name);
  // An archived or deleted document is no longer offered: saving then clears it rather than failing
  const documentLost = documentId !== null && !documents.some((item) => item.id === documentId);
  const [docId, setDocId] = useState(documentId && !documentLost ? documentId : NO_DOCUMENT);
  const [language, setLanguage] = useState(locale);
  const [linkOnReplyOn, setLinkOnReplyOn] = useState(linkOnReply);

  const [state, formAction, pending] = useActionState<State, FormData>(async (_prev, formData) => {
    return updateCampaignAction(id, formData);
  }, null);

  useEffect(() => {
    if (!state) return;
    if ("error" in state) toast.error(state.error);
    else if (state.notice) toast.success(state.notice);
  }, [state]);

  const mailboxItems = mailboxes.map((item) => ({ value: item.id, label: item.email }));
  const documentItems = [
    { value: NO_DOCUMENT, label: t("documentNone") },
    ...documents.map((item) => ({ value: item.id, label: item.title })),
  ];
  const languageItems = [
    { value: "fr", label: t("localeFr") },
    { value: "en", label: t("localeEn") },
  ];
  const needsDocument = (stepCarriesLink || linkOnReplyOn) && docId === NO_DOCUMENT;
  const mailboxLost = !selectable && currentMailbox !== null;
  const mailboxTeammate = selectable && currentMailbox?.teammate === true;

  return (
    <form action={formAction} className="grid gap-5 sm:grid-cols-2">
      <div className="space-y-1.5">
        <label htmlFor="campaign-settings-name" className="text-small font-medium">
          {t("name")}
        </label>
        <Input
          id="campaign-settings-name"
          name="name"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          maxLength={120}
          autoComplete="off"
          disabled={disabled}
        />
      </div>

      <div className="space-y-1.5">
        <span className="text-small font-medium">{t("mailbox")}</span>
        <input type="hidden" name="mailboxId" value={mailbox} />
        <Select
          items={mailboxItems}
          value={mailbox || null}
          onValueChange={(value) => value && setMailbox(value)}
          disabled={disabled}
        >
          <SelectTrigger aria-label={t("mailbox")} className="w-full bg-card">
            <SelectValue placeholder={t("mailboxPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {mailboxItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {mailboxLost && (
          <p role="status" className="text-small text-warning-foreground">
            {t("mailboxInactive", { email: currentMailbox.email })}
          </p>
        )}
        {mailboxTeammate && currentMailbox && (
          <p className="text-small text-muted-foreground">{t("mailboxTeammate", { email: currentMailbox.email })}</p>
        )}
        {!currentMailbox && <p className="text-small text-warning-foreground">{t("mailboxNone")}</p>}
      </div>

      <div className="space-y-1.5">
        <span className="text-small font-medium">{t("document")}</span>
        <input type="hidden" name="documentId" value={docId === NO_DOCUMENT ? "" : docId} />
        <Select
          items={documentItems}
          value={docId}
          onValueChange={(value) => value && setDocId(value)}
          disabled={disabled}
        >
          <SelectTrigger aria-label={t("document")} className="w-full bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {documentItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {documentLost && <p className="text-small text-warning-foreground">{t("documentLost")}</p>}
        <p className="text-small text-muted-foreground">{t("documentNote")}</p>
        {needsDocument && <p className="text-small text-warning-foreground">{t("documentRequired")}</p>}
      </div>

      <div className="space-y-1.5">
        <span className="text-small font-medium">{t("locale")}</span>
        <input type="hidden" name="locale" value={language} />
        <Select
          items={languageItems}
          value={language}
          onValueChange={(value) => value && setLanguage(value)}
          disabled={disabled}
        >
          <SelectTrigger aria-label={t("locale")} className="w-full bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {languageItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-small text-muted-foreground">{t("localeHint")}</p>
      </div>

      <div className="flex items-start gap-3 sm:col-span-2">
        <input type="hidden" name="linkOnReply" value={linkOnReplyOn ? "on" : "off"} />
        <Switch
          id="campaign-link-on-reply"
          checked={linkOnReplyOn}
          onCheckedChange={setLinkOnReplyOn}
          disabled={disabled}
          className="mt-0.5"
        />
        <label htmlFor="campaign-link-on-reply" className="space-y-0.5 text-small">
          <span className="block font-medium">{t("linkOnReply")}</span>
          <span className="block text-muted-foreground">{t("linkOnReplyHint")}</span>
        </label>
      </div>

      {!disabled && (
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? t("saving") : t("save")}
          </Button>
        </div>
      )}
    </form>
  );
}
