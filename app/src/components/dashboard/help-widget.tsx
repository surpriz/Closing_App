"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUp, Check, LifeBuoy, Loader2, X } from "lucide-react";
import { usePathname } from "next/navigation";
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
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
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
    status === "ready" && last?.role === "assistant" ? textOf(last) || (wasSent(last) ? "Transmis à l'équipe Clozer." : "") : "";
  const suggestions = helpSuggestions(pathname);

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

  if (!open) {
    return (
      <Button
        ref={launcherRef}
        size="icon-lg"
        onClick={openPanel}
        aria-label="Aide et suggestions"
        title="Aide et suggestions"
        // Above the mobile tab bar (min-h-14) on phones
        className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 size-11 rounded-full shadow-lg sm:bottom-6"
      >
        <LifeBuoy className="size-5" />
      </Button>
    );
  }

  return (
    <section
      role="dialog"
      aria-label="Aide Clozer"
      onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
      className="fixed inset-0 z-50 flex animate-rise flex-col bg-card sm:inset-auto sm:right-4 sm:bottom-4 sm:z-40 sm:h-[min(620px,calc(100dvh-2rem))] sm:w-[380px] sm:rounded-2xl sm:shadow-xl sm:ring-1 sm:ring-border"
    >
      <header className="flex shrink-0 items-center gap-3 border-b px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
          <LifeBuoy className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Aide Clozer</p>
          <p className="truncate text-small text-muted-foreground">Questions, conseils, idées, bugs</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fermer">
          <X />
        </Button>
      </header>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
        <Bubble role="assistant">
          {`Bonjour${firstName ? ` ${firstName}` : ""} ! Une question sur Clozer, un conseil, un bug à signaler ou une idée ? Je suis là pour ça.`}
        </Bubble>

        {messages.length === 0 && (
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
          // An answer can be only the sending, without a word from the model
          const sent = message.role === "assistant" && wasSent(message);
          if (!text && !sent) return null;
          return (
            <div key={message.id} className="space-y-1">
              {text && <Bubble role={message.role === "user" ? "user" : "assistant"}>{text}</Bubble>}
              {sent && (
                <p className="flex items-center gap-1.5 pl-1 text-small text-muted-foreground">
                  <Check className="size-3.5" aria-hidden />
                  Transmis à l&apos;équipe Clozer
                </p>
              )}
            </div>
          );
        })}

        {waiting && (
          <Bubble role="assistant">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Rédaction…
            </span>
          </Bubble>
        )}

        {error && (
          <p role="alert" className="text-center text-sm text-destructive">
            {LIMIT_ERRORS.test(error.message)
              ? "Vous avez posé beaucoup de questions d'un coup. Réessayez un peu plus tard."
              : "L'assistant est indisponible, réessayez dans un instant."}
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
            maxLength={HELP_MESSAGE_MAX}
            placeholder="Votre question ou votre idée…"
            aria-label="Votre question ou votre idée"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            className="max-h-32 min-h-10 resize-none"
          />
          <Button type="submit" size="icon-lg" disabled={busy || !input.trim()} aria-label="Envoyer">
            <ArrowUp />
          </Button>
        </div>
        <p className="pt-2 text-center text-xs text-muted-foreground">
          Réponses automatiques, l&apos;assistant peut se tromper. Rien n&apos;est transmis sans votre accord.
        </p>
      </form>
    </section>
  );
}
