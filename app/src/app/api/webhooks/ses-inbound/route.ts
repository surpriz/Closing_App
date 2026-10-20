import { receiveSnsPost } from "@/lib/closing/channels/sns";
import { handleInboundReply } from "@/lib/closing/replies/inbound";

// SES receipt rule on INBOUND_REPLY_DOMAIN (S3 action, then SNS) → this URL with ?token=SES_WEBHOOK_TOKEN.
// Prospects' replies to follow-ups, copied to Clozer through the second Reply-To address.
export async function POST(request: Request) {
  const received = await receiveSnsPost(request, process.env.SES_WEBHOOK_TOKEN);
  if (!received.ok) return Response.json({ error: "Rejected" }, { status: received.status });
  if (received.message === null) return Response.json({ ok: true });

  let notification: unknown;
  try {
    notification = JSON.parse(received.message);
  } catch {
    return Response.json({ error: "Invalid message" }, { status: 400 });
  }
  const outcome = await handleInboundReply(notification);
  return Response.json({ ok: true, outcome });
}
