import type { NextRequest } from "next/server";
import { z } from "zod";

import { getLanguageModel } from "@/lib/closing/ai/provider";
import { canTranslate } from "@/lib/closing/brain/budget";
import { SUPPORTED_LOCALES } from "@/lib/closing/constants";
import { getLinkForViewer, getViewerAccess } from "@/lib/closing/links";
import { cachedTranslation, translateArticle, translatePage } from "@/lib/closing/translation/translate";
import { ARTICLE_PART } from "@/lib/closing/translation/translation";
import { prisma } from "@/lib/db";

// A long web article is translated in several rounds of calls
export const maxDuration = 300;

const querySchema = z.object({
  lang: z.enum(SUPPORTED_LOCALES),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
});

/**
 * One part of the document in the reader's language: a PDF page (?page=3) or
 * the web article. Translated on first ask and kept, so the next readers get
 * it from the database. { content: "" } for a page with no text.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/v/[slug]/translation">) {
  const { slug } = await ctx.params;
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return Response.json({ error: "invalid_query" }, { status: 400 });
  const { lang } = parsed.data;

  const link = await getLinkForViewer(slug);
  if (!link || link.document.status !== "READY" || !link.translationEnabled) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const access = await getViewerAccess(link);
  if (!access.allowed) return Response.json({ error: "email_required" }, { status: 403 });

  const { document } = link;
  const article = document.kind === "URL";
  if (document.kind === "VIDEO" || (!article && !parsed.data.page)) {
    return Response.json({ error: "invalid_query" }, { status: 400 });
  }
  if (!article && document.numPages && parsed.data.page! > document.numPages) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const part = article ? ARTICLE_PART : parsed.data.page!;
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

  const cached = await cachedTranslation(document.id, lang, part);
  if (cached !== null) return Response.json({ content: cached }, { headers });

  const llm = getLanguageModel("translate");
  if (!llm) return Response.json({ error: "unavailable" }, { status: 503 });
  if (!(await canTranslate(link.organizationId))) return Response.json({ error: "budget" }, { status: 429 });

  const scope = { documentId: document.id, organizationId: link.organizationId, linkId: link.id };
  try {
    if (!article) return Response.json({ content: await translatePage(llm, scope, lang, part) }, { headers });

    const source = await prisma.document.findUnique({ where: { id: document.id }, select: { readerHtml: true } });
    // A framed site cannot be translated: only the reader view is ours
    if (document.embedUrl || !source?.readerHtml || !document.externalUrl) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    const content = await translateArticle(llm, scope, lang, {
      readerHtml: source.readerHtml,
      externalUrl: document.externalUrl,
    });
    return Response.json({ content }, { headers });
  } catch (error) {
    console.error(`[translation] ${document.id} ${lang} part ${part} failed`, error);
    return Response.json({ error: "failed" }, { status: 502 });
  }
}
