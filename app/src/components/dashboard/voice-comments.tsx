import type { VoiceCommentStatus } from "@/generated/prisma/enums";
import { formatDate, formatRelative } from "@/lib/format";

export type VoiceCommentItem = {
  id: string;
  pageNumber: number;
  reader: string;
  status: VoiceCommentStatus;
  transcript: string | null;
  durationMs: number;
  createdAt: Date;
};

/** Voice comments the prospect left on the pages, newest first. */
export function VoiceComments({ comments }: { comments: VoiceCommentItem[] }) {
  return (
    <ul className="divide-y divide-border">
      {comments.map((comment) => (
        <li key={comment.id} className="space-y-2 px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <span>
              <span className="font-medium">{comment.reader}</span>
              <span className="text-muted-foreground">
                {" "}
                · page {comment.pageNumber} · {Math.max(1, Math.round(comment.durationMs / 1000))} s
              </span>
            </span>
            <time className="text-xs text-muted-foreground" title={formatDate(comment.createdAt)}>
              {formatRelative(comment.createdAt)}
            </time>
          </div>
          <audio controls preload="none" src={`/api/voice-comments/${comment.id}/audio`} className="h-9 w-full max-w-md" />
          {comment.status === "TRANSCRIBED" && comment.transcript ? (
            <p className="text-body">« {comment.transcript} »</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {comment.status === "PENDING" ? "Transcription en cours…" : "Pas de transcription, écoutez-le."}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
