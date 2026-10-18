"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUp, Check, LifeBuoy, Loader2, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { Bubble, textOf } from "@/components/chat/bubble";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ChatUIMessage } from "@/lib/closing/chat/messages";
import { HELP_MESSAGE_MAX } from "@/lib/closing/help/constants";
import { HELP_QUOTA_ERRORS } from "@/lib/closing/help/quota";
import { helpSuggestions } from "@/lib/closing/help/suggestions";

import { OPEN_HELP_EVENT } from "./open-help";

// The route answers 429 with { error: <quota code> }; the transport puts the body in error.message
const LIMIT_ERRORS = new RegExp(HELP_QUOTA_ERRORS.join("|"));

function wasSent(message: ChatUIMessage) {
  return (
    !!message.metadata?.escalated ||
    message.parts.some(
      (part) =>
        part.type === "tool-send_to_team" &&
        part.state === "output-available" &&
        (part.output as { sent?: boolean } | undefined)?.sent === true,
    )
  );
}

/** The users' own assistant: how Clozer works, advice, and a line to the team. */
export function HelpWidget({ firstName }: { firstName: string | null }) {
  const pathname = usePathname();
  const t = useTranslations("nav.helpWidget");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wasOpen = useRef(false);
  const loaded = useRef(false);

  // Only the new question leaves the browser: the server reads the conversation back itself
  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatUIMessage>({
        api: "/api/help",
        // The page comes with each send: the transport outlives page changes
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: { text: textOf(messages[messages.length - 1]), pathname: body?.pathname },
        }),
      }),
    [],
  );
  const { messages, setMessages, sendMessage, status, error, clearError } = useChat<ChatUIMessage>({
    id: "help",
    transport,
  });

  const openPanel = useCallback(() => {
    setOpen(true);
    // The conversation is fetched on first open, not with every dashboard page
    if (loaded.current) return;
    loaded.current = true;
    fetch("/api/help")
      .then((response) => {
        if (!response.ok) throw new Error(`help history ${response.status}`);
        return response.json() as Promise<{ messages: ChatUIMessage[] }>;
      })
      .then((data) => {
        if (data.messages.length) setMessages((current) => (current.length ? current : data.messages));
      })
      .catch(() => {
        // Tried again on the next open
        loaded.current = false;
      });
  }, [setMessages]);

  useEffect(() => {
    window.addEventListener(OPEN_HELP_EVENT, openPanel);
    return () => window.removeEventListener(OPEN_HELP_EVENT, openPanel);
  }, [openPanel]);

  const busy = status === "submitted" || status === "streaming";
  const last = messages[messages.length - 1];
  const waiting = busy && (last?.role === "user" || (last && !textOf(last)));
  // Screen readers hear each finished answer once, not every streamed word
  const announcement =
    status === "ready" && last?.role === "assistant" ? textOf(last) || (wasSent(last) ? t("sentAnnouncement") : "") : "";
  const suggestions = helpSuggestions(pathname, locale);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, waiting]);

  useEffect(() => {
    if (!open) {
      // Back to the "?" in the header that opened the panel
      if (wasOpen.current) document.querySelector<HTMLElement>("[data-help-launcher]")?.focus();
      return;
    }
    wasOpen.current = true;
    inputRef.current?.focus();
    // Full screen on phones: the page behind must not scroll. Never snapshot the
    // current value: opened from the "?" menu, the menu's own scroll lock is still
    // on and restoring it would freeze the page for good.
    if (!window.matchMedia("(max-width: 639px)").matches) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function send(text: string) {
    const question = text.trim().slice(0, HELP_MESSAGE_MAX);
    if (!question || busy) return;
    clearError();
    setInput("");
    void sendMessage({ text: question }, { body: { pathname } });
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send(input);
    }
  }

  // Opened from the "?" in the header, ⌘K or a help link: no corner button competing with the page
  if (!open) return null;

  return (
    <section
      role="dialog"
      aria-label={t("title")}
      onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
      className="fixed inset-0 z-50 flex animate-rise flex-col bg-card sm:inset-auto sm:right-4 sm:bottom-4 sm:z-40 sm:h-[min(620px,calc(100dvh-2rem))] sm:w-[380px] sm:rounded-xl sm:shadow-lg sm:ring-1 sm:ring-foreground/85"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-foreground px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-3">
        <span className="flex size-9 shrink-0 items-center justify-center border border-border bg-background">
          <LifeBuoy className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-semibold">{t("title")}</p>
          <p className="truncate text-small text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label={t("close")}>
          <X />
        </Button>
      </header>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
        <Bubble role="assistant">
          {firstName ? t("greeting", { name: firstName }) : t("greetingNoName")}
        </Bubble>

        {messages.length === 0 && (
          <div className="flex flex-col items-start gap-2 pt-1">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => send(suggestion)}
                className="rounded-sm border border-border bg-background px-3 py-1.5 text-left text-small transition-colors duration-150 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {messages.map((message) => {
          const text = textOf(message);
          // An answer can be only the sending, without a word from the model
          const sent = message.role === "assistant" && wasSent(message);
          if (!text && !sent) return null;
          return (
            <div key={message.id} className="space-y-1">
              {text && <Bubble role={message.role === "user" ? "user" : "assistant"}>{text}</Bubble>}
              {sent && (
                <p className="flex items-center gap-1.5 pl-1 text-small text-muted-foreground">
                  <Check className="size-3.5" aria-hidden />
                  {t("sent")}
                </p>
              )}
            </div>
          );
        })}

        {waiting && (
          <Bubble role="assistant">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t("writing")}
            </span>
          </Bubble>
        )}

        {error && (
          <p role="alert" className="text-center text-small text-destructive">
            {LIMIT_ERRORS.test(error.message)
              ? t("quota")
              : t("unavailable")}
          </p>
        )}
      </div>

      <form
        className="shrink-0 border-t border-border px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
      >
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            rows={1}
            value={input}
            maxLength={HELP_MESSAGE_MAX}
            placeholder={t("placeholder")}
            aria-label={t("inputAria")}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            className="max-h-32 min-h-10 resize-none"
          />
          <Button type="submit" size="icon-lg" disabled={busy || !input.trim()} aria-label={t("send")}>
            <ArrowUp />
          </Button>
        </div>
        <p className="pt-2 text-center text-micro text-muted-foreground">
          {t("disclaimer")}
        </p>
      </form>
    </section>
  );
}
