import { prisma } from "@/lib/db";
import { withExtensionAuth } from "@/lib/extension-auth";

// "Déconnecter" in the extension popup
export const DELETE = withExtensionAuth(async (_request, { tokenId }) => {
  await prisma.extensionToken.update({ where: { id: tokenId }, data: { revokedAt: new Date() } });
  return new Response(null, { status: 204 });
});
