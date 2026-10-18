"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowRight, ArrowUp, Forward, Loader2, MessageCircleQuestion, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { textOf } from "@/components/chat/bubble";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CHAT_MESSAGE_MAX } from "@/lib/closing/chat/constants";
import type { ChatKind } from "@/lib/closing/chat/kind";
import type { ChatUIMessage } from "@/lib/closing/chat/messages";
import { CHAT_QUOTA_ERRORS } from "@/lib/closing/chat/quota";
import type { SupportedLocale } from "@/lib/closing/constants";
import { fillLabel, type ViewerLabels } from "@/lib/closing/i18n/viewer";
import { cn } from "@/lib/utils";

import { useExitIntent } from "./use-exit-intent";
import { sendSignal } from "./view-signal";

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
  /** Owned by the viewer: the call-to-action bar opens the panel too. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * "floating": a round button bottom right, when nothing else sits there.
   * "docked": the trigger is the "Une question ?" button of the bar, only
   * the exit nudge is drawn here, above the bar.
   */
  launcher: "floating" | "docked";
};

/**
 * Above the decision strip, whose height the strip publishes (--decision-bar-h),
 * or above the floating launcher when there is no strip.
 */
const NUDGE_BOTTOM = "bottom-[calc(var(--decision-bar-h,calc(4.25rem+env(safe-area-inset-bottom)))+0.75rem)]";

// The route answers 429 with { error: <quota code> }; the transport puts the body in error.message
const LIMIT_ERRORS = new RegExp(CHAT_QUOTA_ERRORS.join("|"));

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
  open,
  onOpenChange,
  launcher,
  kind,
  initialMessages,
  suggestions,
}: Props) {
  const kindLabels = labels.chatKinds[kind];
  const [nudge, setNudge] = useState(false);
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

  // A reader who already asked something needs no nudge
  const asked = messages.some((message) => message.role === "user");
  useExitIntent(!open && !asked, `clozer:exit-nudge:${slug}`, () => {
    setNudge(true);
    sendSignal(getViewId(), "EXIT_PROMPT_SHOWN");
  });

  function openChat() {
    if (nudge) sendSignal(getViewId(), "EXIT_PROMPT_OPENED");
    setNudge(false);
    onOpenChange(true);
  }

  const sender = senderName ?? labels.chatSenderFallback;
  const withSender = (text: string) => fillLabel(text, { sender });
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
      // Back to the trigger when the panel closes: ours, or the bar's button
      if (wasOpen.current) {
        // The bar has two triggers (its own button, the phone's "Plus" menu): back to the one on screen
        (
          launcherRef.current ??
          [...document.querySelectorAll<HTMLElement>("[data-chat-trigger]")].find((el) => el.offsetParent !== null)
        )?.focus();
      }
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
    const floating = launcher === "floating";
    return (
      <>
        {nudge && (
          <div
            role="status"
            className={cn(
              "fixed right-4 z-30 flex animate-rise items-center gap-1 rounded-lg bg-popover py-1 pr-1 pl-3 text-body text-popover-foreground shadow-md ring-1 ring-border",
              NUDGE_BOTTOM,
            )}
          >
            <button
              type="button"
              onClick={openChat}
              className="flex items-center gap-2 rounded-sm py-1.5 font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MessageCircleQuestion className="size-4 text-muted-foreground" aria-hidden />
              {labels.chatExitNudge}
            </button>
            <Button variant="ghost" size="icon" onClick={() => setNudge(false)} aria-label={labels.chatClose}>
              <X />
            </Button>
          </div>
        )}
        {floating && (
          <Button
            ref={launcherRef}
            size="xl"
            onClick={openChat}
            aria-label={labels.chatLauncher}
            className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 size-12 px-0 shadow-md sm:size-auto sm:h-11 sm:px-4 sm:text-body"
          >
            <MessageCircleQuestion className="size-5" />
            <span className="hidden sm:inline">{labels.chatLauncher}</span>
          </Button>
        )}
      </>
    );
  }

  return (
    <section
      role="dialog"
      aria-label={kindLabels.title}
      onKeyDown={(event) => event.key === "Escape" && onOpenChange(false)}
      className="fixed inset-0 z-50 flex animate-rise flex-col bg-card selection:bg-foreground/15 selection:text-foreground sm:inset-auto sm:right-4 sm:bottom-[calc(var(--decision-bar-h,0px)+1rem)] sm:z-40 sm:h-[min(620px,calc(100dvh_-_var(--decision-bar-h,0px)_-_5rem))] sm:w-[380px] sm:rounded-lg sm:shadow-lg sm:ring-1 sm:ring-border"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-foreground py-2 pt-[max(0.5rem,env(safe-area-inset-top))] pr-2 pl-4 sm:pt-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-semibold">{kindLabels.title}</p>
          {senderName && <p className="truncate text-small text-muted-foreground">{senderName}</p>}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 sm:size-9"
          onClick={() => onOpenChange(false)}
          aria-label={labels.chatClose}
        >
          <X />
        </Button>
      </header>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
        <Line role="assistant">{withSender(labels.chatIntro)}</Line>

        {messages.length === 0 && suggestions.length > 0 && (
          <ul className="border-y border-border">
            {suggestions.map((suggestion) => (
              <li key={suggestion} className="border-t border-border first:border-t-0">
                <button
                  type="button"
                  onClick={() => send(suggestion)}
                  className="group flex min-h-11 w-full items-center gap-3 py-2 text-left text-body outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  <span className="flex-1">{suggestion}</span>
                  <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-out-soft group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </button>
              </li>
            ))}
          </ul>
        )}

        {messages.map((message) => {
          const text = textOf(message);
          // An answer can be only the forwarding, without a word from the model
          const forwarded = message.role === "assistant" && wasForwarded(message);
          if (!text && !forwarded) return null;
          return (
            <div key={message.id} className="space-y-1">
              {text && <Line role={message.role === "user" ? "user" : "assistant"}>{text}</Line>}
              {forwarded && (
                <p className="flex items-center gap-1.5 text-small text-muted-foreground">
                  <Forward className="size-3.5" aria-hidden />
                  {withSender(labels.chatForwarded)}
                </p>
              )}
            </div>
          );
        })}

        {waiting && (
          <Line role="assistant">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
              {labels.chatThinking}
            </span>
          </Line>
        )}

        {error && (
          <p role="alert" className="text-small text-destructive">
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
            className="max-h-32 min-h-11 resize-none rounded-md caret-foreground sm:min-h-10"
          />
          <Button
            type="submit"
            size="icon-lg"
            className="size-11 sm:size-10"
            disabled={busy || !input.trim()}
            aria-label={labels.send}
          >
            <ArrowUp />
          </Button>
        </div>
        <p className="pt-2 text-micro text-pretty text-muted-foreground">{withSender(labels.chatDisclaimer)}</p>
      </form>
    </section>
  );
}

/**
 * One turn of the conversation, kept quiet: the assistant's answers read as
 * plain text on the sheet, the reader's own questions sit in a near-square
 * ink block on the right.
 */
function Line({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "text-body break-words whitespace-pre-wrap",
        role === "user"
          ? "ml-auto w-fit max-w-[85%] rounded-md bg-primary px-3 py-2 text-primary-foreground"
          : "max-w-[92%] border-l border-foreground/20 pl-3",
      )}
    >
      {children}
    </div>
  );
}
