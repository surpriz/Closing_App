import { inBackground } from "@/lib/closing/background";
import { prisma } from "@/lib/db";
import { hashExtensionToken, parseBearer } from "@/lib/extension-tokens";
import { isUserBlocked } from "@/lib/platform-admin";

const TOUCH_EVERY_MS = 60 * 60 * 1000;

export type ExtensionCaller = {
  tokenId: string;
  user: { id: string; name: string; email: string };
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
      user: { select: { id: true, name: true, email: true, banned: true, banExpires: true } },
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
  return { tokenId: row.id, user: { id, name, email }, organization: { id: row.organization.id, name: row.organization.name } };
}

export function extError(status: number, error: string, message?: string) {
  return Response.json({ error, message: message ?? error }, { status });
}

// Route guard: 401 JSON instead of the dashboard's redirect to /login
export function withExtensionAuth<Ctx>(
  handler: (request: Request, caller: ExtensionCaller, ctx: Ctx) => Promise<Response>,
) {
  return async (request: Request, ctx: Ctx) => {
    const caller = await authenticateExtension(request);
    if (!caller) return extError(401, "unauthorized", "Reconnectez l'extension Clozer.");
    return handler(request, caller, ctx);
  };
}
