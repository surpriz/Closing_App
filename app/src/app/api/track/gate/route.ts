import { z } from "zod";

import { confirmDraftOnOpen } from "@/lib/closing/documents/create-link";
import { markFollowupClicked } from "@/lib/closing/followups/attribution";
import { getLinkForViewer } from "@/lib/closing/links";
import { getRequestContext } from "@/lib/closing/tracking/request-context";
import { prisma } from "@/lib/db";
import { consumeLimit, perLink } from "@/lib/rate-limit";
import { isWorkspaceMember } from "@/lib/session";

const bodySchema = z.object({ slug: z.string().min(1).max(64), followupId: z.string().max(40).nullish() });

// The email gate showed in a browser (sendBeacon, so a scanner that only fetches the page never
// counts): someone clicked the link. Until a reading starts, that is "clicked, not read".
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = JSON.parse(await request.text());
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) return new Response(null, { status: 400 });

  const link = await getLinkForViewer(parsed.data.slug);
  if (!link || link.shared) return new Response(null, { status: 204 });
  if (!(await consumeLimit("trackGate", request.headers, perLink(request.headers, link.id)))) {
    return new Response(null, { status: 429 });
  }
  if (getRequestContext(request.headers).isBot || (await isWorkspaceMember(link.organizationId))) {
    return new Response(null, { status: 204 });
  }

  const now = new Date();
  await prisma.link.update({
    where: { id: link.id },
    data: { gateVisits: { increment: 1 }, ...(!link.gateSeenAt && { gateSeenAt: now }) },
  });
  // Clicked means it went out, even when the send was never confirmed
  await confirmDraftOnOpen(link.id, now);
  if (parsed.data.followupId) await markFollowupClicked(parsed.data.followupId, link.id, now);
  return new Response(null, { status: 204 });
}
