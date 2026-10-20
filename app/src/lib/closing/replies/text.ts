/**
 * Reading a reply: what the prospect wrote this time (not the quoted history), and whether a
 * person wrote it at all. Pure.
 */

const AUTO_SUBJECT =
  /^(auto(matic)?[ -]?(reply|response|antwort)|out of (the )?office|absent|absence|r[ée]ponse automatique|abwesenheit|fuera de la oficina|risposta automatica|ausente|niet aanwezig|undeliverable|delivery status notification|mail delivery)/i;

/** Out-of-office and other machine answers: logged nowhere, they must not stop the follow-ups. */
export function isAutoReply(headers: Record<string, string | undefined>, subject: string | null | undefined) {
  const auto = headers["auto-submitted"]?.toLowerCase();
  if (auto && auto !== "no") return true;
  if (headers["x-autoreply"] || headers["x-autorespond"]) return true;
  const precedence = headers["precedence"]?.toLowerCase();
  if (precedence === "auto_reply" || precedence === "bulk" || precedence === "junk") return true;
  return AUTO_SUBJECT.test((subject ?? "").replace(/^(re|tr|fw|fwd|aw|wg)\s*:\s*/i, "").trim());
}

// The line mail apps put above the quoted message, in the languages we see
const QUOTE_HEADER = [
  /^On .{4,200} wrote:\s*$/i,
  /^Le .{4,200} a écrit\s*:\s*$/i,
  /^Am .{4,200} schrieb .{0,200}:\s*$/i,
  /^El .{4,200} escribió\s*:\s*$/i,
  /^Il .{4,200} ha scritto\s*:\s*$/i,
  /^Em .{4,200} escreveu\s*:\s*$/i,
  /^-{2,}\s*(Original Message|Message d'origine|Ursprüngliche Nachricht|Mensaje original)\s*-{2,}/i,
  /^(From|De|Von|Da)\s*:\s.+/,
  /^_{10,}\s*$/,
];

/** The new text of a reply: everything above the quoted history, trimmed, at most `max` characters. */
export function replyExcerpt(text: string | null | undefined, max = 1000) {
  if (!text) return null;
  const kept: string[] = [];
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    if (line.startsWith(">") || QUOTE_HEADER.some((pattern) => pattern.test(line.trim()))) break;
    kept.push(line);
  }
  const excerpt = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!excerpt) return null;
  return excerpt.length > max ? `${excerpt.slice(0, max - 1).trimEnd()}…` : excerpt;
}
