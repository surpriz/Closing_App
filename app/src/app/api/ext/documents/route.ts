import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createFileDocument, DocumentInputError } from "@/lib/closing/documents/create-document";
import { prisma } from "@/lib/db";
import { extError, withExtensionAuth } from "@/lib/extension-auth";

// Documents the seller can pick from the mail composer
export const GET = withExtensionAuth(async (request, { organization }) => {
  const q = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100);
  const documents = await prisma.document.findMany({
    where: {
      organizationId: organization.id,
      archivedAt: null,
      status: "READY",
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, name: true, kind: true, numPages: true, createdAt: true },
  });
  return Response.json({ documents });
});

const createSchema = z.object({
  pathname: z.string().min(1).max(512),
  name: z.string().min(1).max(200),
  sha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
});

// Called once the extension has put the PDF in Blob storage
export const POST = withExtensionAuth(async (request, { user, organization }) => {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return extError(400, "invalid");

  try {
    const result = await createFileDocument({
      organizationId: organization.id,
      userId: user.id,
      ...parsed.data,
    });
    revalidatePath("/documents");
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof DocumentInputError) {
      return extError(400, "not_pdf", "Ce fichier n'est pas un PDF valide.");
    }
    console.error("[ext] document creation failed", error);
    return extError(500, "server", "Clozer n'a pas pu enregistrer le PDF. Réessayez.");
  }
});
