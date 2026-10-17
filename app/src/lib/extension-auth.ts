import { pickUiLocale, type UiLocale } from "@/i18n/locale";
import { getTranslator } from "@/i18n/messages";
import { inBackground } from "@/lib/closing/background";
import { prisma } from "@/lib/db";
import { hashExtensionToken, parseBearer } from "@/lib/extension-tokens";
import { isUserBlocked } from "@/lib/platform-admin";
import { toUiLocale } from "@/lib/seller-locale";

const TOUCH_EVERY_MS = 60 * 60 * 1000;

export type ExtensionCaller = {
  tokenId: string;
  /** locale: the seller's, for every message the extension shows. */
  user: { id: string; name: string; email: string; locale: UiLocale };
  organization: { id: string; name: string };
};

// Resolves the seller behind an /api/ext/* request. Null when the token is unknown,
// revoked, the seller left the workspace, is disabled, or the workspace is suspended.
export async function authenticateExtension(request: Request): Promise<ExtensionCaller | null> {
  const token = parseBearer(request.headers.get("authorization"));
  if (!token) return null;

  const row = await prisma.extensionToken.findUnique({
    where: { tokenHash: hashExtensionToken(token) },
    select: {
      id: true,
      revokedAt: true,
      lastUsedAt: true,
      organizationId: true,
      user: { select: { id: true, name: true, email: true, locale: true, banned: true, banExpires: true } },
      organization: { select: { id: true, name: true, suspendedAt: true } },
    },
  });
  if (!row || row.revokedAt) return null;
  if (isUserBlocked(row.user) || row.organization.suspendedAt) return null;

  const member = await prisma.member.findFirst({
    where: { userId: row.user.id, organizationId: row.organizationId },
    select: { id: true },
  });
  if (!member) return null;

  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > TOUCH_EVERY_MS) {
    inBackground("extension-token-touch", () =>
      prisma.extensionToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }),
    );
  }

  const { id, name, email } = row.user;
  return {
    tokenId: row.id,
    user: { id, name, email, locale: toUiLocale(row.user.locale) },
    organization: { id: row.organization.id, name: row.organization.name },
  };
}

/** Language of a request with no seller behind it: the extensions send Accept-Language. */
export function requestUiLocale(request: Request) {
  return pickUiLocale(request.headers.get("accept-language"));
}

/** `message` is shown as is by the extensions: pass it translated. */
export function extError(status: number, error: string, message?: string) {
  return Response.json({ error, message: message ?? error }, { status });
}

// Route guard: 401 JSON instead of the dashboard's redirect to /login
export function withExtensionAuth<Ctx>(
  handler: (request: Request, caller: ExtensionCaller, ctx: Ctx) => Promise<Response>,
) {
  return async (request: Request, ctx: Ctx) => {
    const caller = await authenticateExtension(request);
    if (!caller) {
      return extError(401, "unauthorized", getTranslator(requestUiLocale(request))("server.ext.unauthorized"));
    }
    return handler(request, caller, ctx);
  };
}
