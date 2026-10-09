import { ChevronRight, Forward, TriangleAlert } from "lucide-react";

import { CHAT_FLAG_LABELS, type ChatFlag } from "@/lib/closing/chat/lint";
import { formatDate, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export type TranscriptMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  escalated: boolean;
  flags: string[];
  createdAt: Date;
};

export type TranscriptConversation = {
  visitorId: string;
  reader: string;
  messages: TranscriptMessage[];
};

/** What prospects asked the assistant on this link, one conversation per browser. */
export function ChatTranscript({ conversations }: { conversations: TranscriptConversation[] }) {
  return (
    <div className="divide-y divide-border">
      {conversations.map((conversation, index) => {
        const questions = conversation.messages.filter((m) => m.role === "USER");
        const forwarded = questions.filter((m) => m.escalated).length;
        const last = conversation.messages[conversation.messages.length - 1];
        return (
          <details key={conversation.visitorId} open={index === 0} className="group px-4 py-3">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 outline-none focus-visible:underline [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 text-sm">
                <span className="font-medium">{conversation.reader}</span>
                <span className="block text-muted-foreground">
                  {questions.length} {questions.length === 1 ? "question" : "questions"}
                  {forwarded > 0 && `, dont ${forwarded} pour vous`}
                  {last && ` · ${formatRelative(last.createdAt)}`}
                </span>
              </span>
              <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
            </summary>

            <ol className="mt-3 space-y-2">
              {conversation.messages.map((message) => (
                <li
                  key={message.id}
                  className={cn("text-sm", message.role === "USER" ? "font-medium" : "border-l-2 pl-3 text-muted-foreground")}
                >
                  <p className="whitespace-pre-wrap" title={formatDate(message.createdAt)}>
                    {message.content || "(pas de réponse)"}
                  </p>
                  {message.escalated && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs font-normal text-brand">
                      <Forward className="size-3" aria-hidden /> Transmise : l&apos;assistant a dit que vous répondriez
                    </p>
                  )}
                  {message.flags.length > 0 && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-heat-hot">
                      <TriangleAlert className="size-3" aria-hidden /> À vérifier :{" "}
                      {message.flags.map((flag) => CHAT_FLAG_LABELS[flag as ChatFlag] ?? flag).join(", ")}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </details>
        );
      })}
    </div>
  );
}
