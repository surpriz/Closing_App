import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { z } from "zod";

import { getLanguageModel } from "@/lib/closing/ai/provider";
import { inBackground } from "@/lib/closing/background";
import { analyzeDeal, markDealDirty } from "@/lib/closing/brain/analyze-deal";
import {
  MAX_PAGE_DURATION_PER_FLUSH_MS,
  MAX_TRACKING_EVENTS_PER_BATCH,
} from "@/lib/closing/constants";
import { refreshEngagementScore } from "@/lib/closing/engagement/refresh-score";
import { VISITOR_COOKIE } from "@/lib/closing/tracking/visitor";
import { evaluateHotPricing } from "@/lib/closing/triggers/hot-pricing";
import { prisma } from "@/lib/db";

// The deal analysis runs after the response when a reader leaves
export const maxDuration = 120;

const batchSchema = z.object({
  viewId: z.string().min(1).max(64),
  events: z
    .array(
      z.object({
        pageNumber: z.number().int().min(1).max(5000),
        durationMs: z.number().int().min(0).max(24 * 60 * 60 * 1000),
        scrollDepth: z.number().min(0).max(1).optional(),
      }),
    )
    .max(MAX_TRACKING_EVENTS_PER_BATCH),
  currentPage: z.number().int().min(1).max(5000).optional(),
  left: z.boolean().optional(),
});

// Receives reading time per page from the viewer (fetch keepalive or sendBeacon)
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = JSON.parse(await request.text());
  } catch {
    return new Response(null, { status: 400 });
  }

  const parsed = batchSchema.safeParse(payload);
  if (!parsed.success) return new Response(null, { status: 400 });
  const { viewId, events, currentPage, left = false } = parsed.data;

  const view = await prisma.documentView.findUnique({
    where: { id: viewId },
    select: {
      id: true,
      linkId: true,
      visitorId: true,
      prospectId: true,
      isBot: true,
      link: { select: { document: { select: { numPages: true } } } },
    },
  });

  // Only the browser that opened the view may report time on it
  const visitorId = (await cookies()).get(VISITOR_COOKIE)?.value;
  if (!view || !visitorId || view.visitorId !== visitorId) {
    return new Response(null, { status: 403 });
  }

  const numPages = view.link.document.numPages ?? Number.MAX_SAFE_INTEGER;
  const valid = events
    .filter((e) => e.pageNumber <= numPages && e.durationMs > 0)
    .map((e) => ({
      ...e,
      durationMs: Math.min(e.durationMs, MAX_PAGE_DURATION_PER_FLUSH_MS),
    }));
  const now = new Date();

  // An idle reader sends nothing, so only reading time keeps a view live
  if (valid.length === 0) {
    if (left) {
      await prisma.documentView.update({ where: { id: view.id }, data: { leftAt: now } });
      if (!view.isBot) inBackground("brain", () => analyzeDeal(view.linkId, "SESSION_ENDED"));
    }
    return new Response(null, { status: 204 });
  }

  const totalMs = valid.reduce((sum, e) => sum + e.durationMs, 0);
  const maxPage = Math.max(...valid.map((e) => e.pageNumber));
  const onScreen = currentPage && currentPage <= numPages ? currentPage : maxPage;

  await prisma.$transaction([
    ...valid.map(
      (e) => prisma.$executeRaw`
        INSERT INTO "page_views"
          ("id", "viewId", "linkId", "pageNumber", "totalDurationMs", "hits", "maxScrollDepth", "firstSeenAt", "lastSeenAt")
        VALUES
          (${randomUUID()}, ${view.id}, ${view.linkId}, CAST(${e.pageNumber} AS INTEGER),
           CAST(${e.durationMs} AS INTEGER), 1, CAST(${e.scrollDepth ?? null} AS DOUBLE PRECISION), ${now}, ${now})
        ON CONFLICT ("viewId", "pageNumber") DO UPDATE SET
          "totalDurationMs" = "page_views"."totalDurationMs" + EXCLUDED."totalDurationMs",
          "hits" = "page_views"."hits" + 1,
          "maxScrollDepth" = GREATEST("page_views"."maxScrollDepth", EXCLUDED."maxScrollDepth"),
          "lastSeenAt" = EXCLUDED."lastSeenAt"`,
    ),
    prisma.$executeRaw`
      UPDATE "document_views" SET
        "totalDurationMs" = "totalDurationMs" + CAST(${totalMs} AS INTEGER),
        "maxPageReached" = GREATEST("maxPageReached", CAST(${maxPage} AS INTEGER)),
        "lastSeenAt" = ${now},
        "currentPage" = CAST(${onScreen} AS INTEGER),
        "leftAt" = ${left ? now : null}
      WHERE "id" = ${view.id}`,
    // Bots keep their own rows but never make a link look opened.
    ...(view.isBot
      ? []
      : [
          prisma.link.update({
            where: { id: view.linkId },
            data: { lastActivityAt: now },
          }),
        ]),
    ...(view.prospectId && !view.isBot
      ? [
          prisma.prospect.update({
            where: { id: view.prospectId },
            data: { lastSeenAt: now },
          }),
        ]
      : []),
  ]);

  if (!view.isBot) {
    inBackground("tracking", async () => {
      await refreshEngagementScore(view.linkId);
      // With the deal analysis available, it decides follow-ups; the pricing rule is the fallback
      if (!getLanguageModel("analyze")) await evaluateHotPricing(view.id);
      // The reader left: read the deal now. Otherwise flag it, the engine catches
      // sessions whose "left" beacon never arrived.
      if (left) await analyzeDeal(view.linkId, "SESSION_ENDED");
      else await markDealDirty(view.linkId, now);
    });
  }

  return new Response(null, { status: 204 });
}
