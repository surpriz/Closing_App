import type { NextRequest } from "next/server";
import { z } from "zod";

import { getLanguageModel } from "@/lib/closing/ai/provider";
import { canTranslate } from "@/lib/closing/brain/budget";
import { SUPPORTED_LOCALES } from "@/lib/closing/constants";
import { getLinkForViewer, getViewerAccess } from "@/lib/closing/links";
import { advanceFileTranslation } from "@/lib/closing/translation/file-translation";
import { cachedTranslation, translateArticle } from "@/lib/closing/translation/translate";
import { ARTICLE_PART } from "@/lib/closing/translation/translation";
import { prisma } from "@/lib/db";

// A long web article is translated in several rounds of calls
export const maxDuration = 300;

const querySchema = z.object({ lang: z.enum(SUPPORTED_LOCALES) });
const HEADERS = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

/**
 * The document in the reader's language. A PDF is translated by DeepL with its
 * layout: the answer says where the job stands, and the viewer asks again
 * until it is done ({ status: "done" }, then /file?lang= serves it). A web
 * article is translated by the AI and comes back as { content }.
 * Both are kept, so the next readers get them without waiting.
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
  const scope = { documentId: document.id, organizationId: link.organizationId, linkId: link.id };

  if (document.kind === "FILE") {
    const state = await advanceFileTranslation(scope, document, lang);
    if (state.status === "budget") return Response.json({ error: "budget" }, { status: 429 });
    return Response.json(state, { headers: HEADERS });
  }
  // A framed site cannot be translated: only the reader view is ours
  if (document.kind !== "URL" || document.embedUrl || !document.externalUrl) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const cached = await cachedTranslation(document.id, lang, ARTICLE_PART);
  if (cached !== null) return Response.json({ content: cached }, { headers: HEADERS });

  const llm = getLanguageModel("translate");
  if (!llm) return Response.json({ error: "unavailable" }, { status: 503 });
  if (!(await canTranslate(link.organizationId))) return Response.json({ error: "budget" }, { status: 429 });

  const source = await prisma.document.findUnique({ where: { id: document.id }, select: { readerHtml: true } });
  if (!source?.readerHtml) return Response.json({ error: "not_found" }, { status: 404 });
  try {
    const content = await translateArticle(llm, scope, lang, {
      readerHtml: source.readerHtml,
      externalUrl: document.externalUrl,
    });
    return Response.json({ content }, { headers: HEADERS });
  } catch (error) {
    console.error(`[translation] article ${document.id} ${lang} failed`, error);
    return Response.json({ error: "failed" }, { status: 502 });
  }
}
