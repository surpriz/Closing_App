import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { z } from "zod";

import {
  MAX_PAGE_DURATION_PER_FLUSH_MS,
  MAX_TRACKING_EVENTS_PER_BATCH,
} from "@/lib/closing/constants";
import { VISITOR_COOKIE } from "@/lib/closing/tracking/visitor";
import { prisma } from "@/lib/db";

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
    .min(1)
    .max(MAX_TRACKING_EVENTS_PER_BATCH),
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
  const { viewId, events } = parsed.data;

  const view = await prisma.documentView.findUnique({
    where: { id: viewId },
    select: {
      id: true,
      linkId: true,
      visitorId: true,
      prospectId: true,
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
  if (valid.length === 0) return new Response(null, { status: 204 });

  const totalMs = valid.reduce((sum, e) => sum + e.durationMs, 0);
  const maxPage = Math.max(...valid.map((e) => e.pageNumber));
  const now = new Date();

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
        "lastSeenAt" = ${now}
      WHERE "id" = ${view.id}`,
    prisma.link.update({
      where: { id: view.linkId },
      data: { lastActivityAt: now },
    }),
    ...(view.prospectId
      ? [
          prisma.prospect.update({
            where: { id: view.prospectId },
            data: { lastSeenAt: now },
          }),
        ]
      : []),
  ]);

  return new Response(null, { status: 204 });
}
