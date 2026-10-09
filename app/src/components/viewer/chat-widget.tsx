"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUp, Forward, Loader2, MessageCircleQuestion, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CHAT_MESSAGE_MAX } from "@/lib/closing/chat/constants";
import type { ChatKind } from "@/lib/closing/chat/kind";
import type { ChatUIMessage } from "@/lib/closing/chat/messages";
import { CHAT_QUOTA_ERRORS } from "@/lib/closing/chat/quota";
import type { SupportedLocale } from "@/lib/closing/constants";
import type { ViewerLabels } from "@/lib/closing/i18n/viewer";
import { cn } from "@/lib/utils";

export type ChatWidgetData = {
  /** Family of the document: sets the title and the placeholder. */
  kind: ChatKind;
  initialMessages: ChatUIMessage[];
  suggestions: string[];
};

type Props = ChatWidgetData & {
  slug: string;
  labels: ViewerLabels;
  locale: SupportedLocale;
  senderName: string | null;
  getViewId: () => string | null;
  /** The call-to-action bar is at the bottom: the launcher sits above it. */
  ctaVisible: boolean;
};

// The route answers 429 with { error: <quota code> }; the transport puts the body in error.message
const LIMIT_ERRORS = new RegExp(CHAT_QUOTA_ERRORS.join("|"));

function textOf(message: ChatUIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

// The seller testing their own link gets forwarded: false, nothing was sent
function wasForwarded(message: ChatUIMessage) {
  return (
    !!message.metadata?.escalated ||
    message.parts.some(
      (part) =>
        part.type === "tool-escalate_to_seller" &&
        part.state === "output-available" &&
        (part.output as { forwarded?: boolean } | undefined)?.forwarded === true,
    )
  );
}

export function ChatWidget({
  slug,
  labels,
  locale,
  senderName,
  getViewId,
  ctaVisible,
  kind,
  initialMessages,
  suggestions,
}: Props) {
  const kindLabels = labels.chatKinds[kind];
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // Only the new question leaves the browser: the server reads the conversation back itself
  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatUIMessage>({
        api: `/api/v/${slug}/chat`,
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { text: textOf(messages[messages.length - 1]), viewId: getViewId(), locale },
        }),
      }),
    [slug, getViewId, locale],
  );
  const { messages, sendMessage, status, error, clearError } = useChat<ChatUIMessage>({
    id: `chat-${slug}`,
    messages: initialMessages,
    transport,
  });

  const sender = senderName ?? labels.chatSenderFallback;
  const withSender = (text: string) => text.replaceAll("{sender}", sender);
  const busy = status === "submitted" || status === "streaming";
  const last = messages[messages.length - 1];
  const waiting = busy && (last?.role === "user" || (last && !textOf(last)));
  // Screen readers hear each finished answer once, not every streamed word
  const announcement =
    status === "ready" && last?.role === "assistant"
      ? textOf(last) || (wasForwarded(last) ? withSender(labels.chatForwarded) : "")
      : "";

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, waiting]);

  useEffect(() => {
    if (!open) {
      // Back to the launcher when the panel closes
      if (wasOpen.current) launcherRef.current?.focus();
      return;
    }
    wasOpen.current = true;
    inputRef.current?.focus();
    // Full screen on phones: the page behind must not scroll
    const phone = window.matchMedia("(max-width: 639px)").matches;
    const overflow = document.body.style.overflow;
    if (phone) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  function send(text: string) {
    const question = text.trim().slice(0, CHAT_MESSAGE_MAX);
    if (!question || busy) return;
    clearError();
    setInput("");
    void sendMessage({ text: question });
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send(input);
    }
  }

  if (!open) {
    return (
      <Button
        ref={launcherRef}
        size="xl"
        onClick={() => setOpen(true)}
        aria-label={labels.chatLauncher}
        className={cn(
          "fixed right-4 z-30 size-12 rounded-full px-0 shadow-lg sm:size-auto sm:px-5",
          ctaVisible ? "bottom-[calc(7.5rem+env(safe-area-inset-bottom))] sm:bottom-24 lg:bottom-6" : "bottom-6",
        )}
      >
        <MessageCircleQuestion className="size-5" />
        <span className="hidden sm:inline">{labels.chatLauncher}</span>
      </Button>
    );
  }

  return (
    <section
      role="dialog"
      aria-label={kindLabels.title}
      onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
      className="fixed inset-0 z-50 flex animate-rise flex-col bg-card sm:inset-auto sm:right-4 sm:bottom-4 sm:z-40 sm:h-[min(620px,calc(100dvh-2rem))] sm:w-[380px] sm:rounded-2xl sm:shadow-xl sm:ring-1 sm:ring-border"
    >
      <header className="flex shrink-0 items-center gap-3 border-b px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
          <MessageCircleQuestion className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{kindLabels.title}</p>
          {senderName && <p className="truncate text-small text-muted-foreground">{senderName}</p>}
        </div>
        <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label={labels.chatClose}>
          <X />
        </Button>
      </header>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
        <Bubble role="assistant">{withSender(labels.chatIntro)}</Bubble>

        {messages.length === 0 && suggestions.length > 0 && (
          <div className="flex flex-col items-start gap-2 pt-1">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => send(suggestion)}
                className="rounded-full border bg-background px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {messages.map((message) => {
          const text = textOf(message);
          // An answer can be only the forwarding, without a word from the model
          const forwarded = message.role === "assistant" && wasForwarded(message);
          if (!text && !forwarded) return null;
          return (
            <div key={message.id} className="space-y-1">
              {text && <Bubble role={message.role === "user" ? "user" : "assistant"}>{text}</Bubble>}
              {forwarded && (
                <p className="flex items-center gap-1.5 pl-1 text-small text-muted-foreground">
                  <Forward className="size-3.5" aria-hidden />
                  {withSender(labels.chatForwarded)}
                </p>
              )}
            </div>
          );
        })}

        {waiting && (
          <Bubble role="assistant">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {labels.chatThinking}
            </span>
          </Bubble>
        )}

        {error && (
          <p role="alert" className="text-center text-sm text-destructive">
            {LIMIT_ERRORS.test(error.message) ? withSender(labels.chatLimit) : labels.chatError}
          </p>
        )}
      </div>

      <form
        className="shrink-0 border-t px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
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
            maxLength={CHAT_MESSAGE_MAX}
            placeholder={kindLabels.placeholder}
            aria-label={kindLabels.placeholder}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            className="max-h-32 min-h-10 resize-none"
          />
          <Button type="submit" size="icon-lg" disabled={busy || !input.trim()} aria-label={labels.send}>
            <ArrowUp />
          </Button>
        </div>
        <p className="pt-2 text-center text-xs text-muted-foreground">{withSender(labels.chatDisclaimer)}</p>
      </form>
    </section>
  );
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "w-fit max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words",
        role === "user" ? "ml-auto rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted",
      )}
    >
      {children}
    </div>
  );
}
