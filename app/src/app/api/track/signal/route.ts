import { cookies } from "next/headers";
import { z } from "zod";

import { ViewSignalType } from "@/generated/prisma/enums";
import { inBackground } from "@/lib/closing/background";
import { markDealDirty } from "@/lib/closing/brain/analyze-deal";
import { refreshEngagementScore } from "@/lib/closing/engagement/refresh-score";
import { MAX_SIGNALS_PER_VIEW, ONCE_PER_VIEW, signalDetail, signalValue } from "@/lib/closing/tracking/view-signals";
import { VISITOR_COOKIE } from "@/lib/closing/tracking/visitor";
import { prisma } from "@/lib/db";

const signalSchema = z.object({
  viewId: z.string().min(1).max(64),
  type: z.enum(ViewSignalType),
  valueMs: z.number().min(0).max(24 * 60 * 60 * 1000).optional(),
  detail: z.string().max(16).optional(),
});

// What the reader did around the content: opened the site, came back, downloaded, translated (sendBeacon)
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = JSON.parse(await request.text());
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = signalSchema.safeParse(payload);
  if (!parsed.success) return new Response(null, { status: 400 });
  const { viewId, type } = parsed.data;

  const view = await prisma.documentView.findUnique({
    where: { id: viewId },
    select: {
      id: true,
      linkId: true,
      visitorId: true,
      isBot: true,
      link: { select: { organization: { select: { suspendedAt: true } } } },
    },
  });
  // Only the browser that opened the view may report on it
  const visitorId = (await cookies()).get(VISITOR_COOKIE)?.value;
  if (!view || !visitorId || view.visitorId !== visitorId) {
    return new Response(null, { status: 403 });
  }
  if (view.link.organization.suspendedAt) return new Response(null, { status: 404 });

  const valueMs = signalValue(type, parsed.data.valueMs);
  const detail = signalDetail(type, parsed.data.detail);
  if (view.isBot || valueMs === undefined || detail === undefined) return new Response(null, { status: 204 });

  const existing = await prisma.viewSignal.findMany({ where: { viewId }, select: { type: true, detail: true } });
  if (existing.length >= MAX_SIGNALS_PER_VIEW) return new Response(null, { status: 204 });
  // Once per session, and a translation once per language
  if (
    (ONCE_PER_VIEW.includes(type) || type === "TRANSLATED") &&
    existing.some((signal) => signal.type === type && signal.detail === detail)
  ) {
    return new Response(null, { status: 204 });
  }

  await prisma.viewSignal.create({ data: { viewId, linkId: view.linkId, type, valueMs, detail } });
  inBackground("signal", async () => {
    await refreshEngagementScore(view.linkId);
    await markDealDirty(view.linkId);
  });
  return new Response(null, { status: 204 });
}
