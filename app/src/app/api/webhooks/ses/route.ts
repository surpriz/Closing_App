import { receiveSnsPost } from "@/lib/closing/channels/sns";
import { handleSesEvent } from "@/lib/closing/channels/ses-events";

// SES configuration set → SNS topic → this URL with ?token=SES_WEBHOOK_TOKEN.
// Deliveries, bounces and complaints of the emails sent to prospects.
export async function POST(request: Request) {
  const received = await receiveSnsPost(request, process.env.SES_WEBHOOK_TOKEN);
  if (!received.ok) return Response.json({ error: "Rejected" }, { status: received.status });
  if (received.message === null) return Response.json({ ok: true });

  let event: unknown;
  try {
    event = JSON.parse(received.message);
  } catch {
    return Response.json({ error: "Invalid message" }, { status: 400 });
  }
  const outcome = await handleSesEvent(event);
  return Response.json({ ok: true, outcome });
}
