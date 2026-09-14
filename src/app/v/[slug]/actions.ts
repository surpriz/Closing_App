"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { inBackground } from "@/lib/closing/background";
import { refreshEngagementScore } from "@/lib/closing/engagement/refresh-score";
import { cancelOpenFollowups } from "@/lib/closing/followups/queue";
import { getLinkForViewer, getViewerAccess } from "@/lib/closing/links";
import {
  EMAIL_COOKIE_MAX_AGE,
  VISITOR_COOKIE,
  emailCookieName,
} from "@/lib/closing/tracking/visitor";
import { prisma } from "@/lib/db";

export type UnlockState = { error?: "invalid_email" | "not_found" } | null;

const unlockSchema = z.object({
  email: z.email().max(254),
  name: z.string().max(120).optional(),
});

export async function unlockWithEmail(
  slug: string,
  _prev: UnlockState,
  formData: FormData,
): Promise<UnlockState> {
  const link = await getLinkForViewer(slug);
  if (!link) return { error: "not_found" };

  const parsed = unlockSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    name: String(formData.get("name") ?? "").trim() || undefined,
  });
  if (!parsed.success) return { error: "invalid_email" };

  const { email, name } = parsed.data;
  await prisma.prospect.upsert({
    where: { linkId_email: { linkId: link.id, email } },
    create: { linkId: link.id, email, name },
    update: name ? { name } : {},
  });

  (await cookies()).set(emailCookieName(link.id), email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: EMAIL_COOKIE_MAX_AGE,
    path: "/",
  });

  redirect(`/v/${slug}`);
}

const actionSchema = z.object({
  slug: z.string().min(1).max(64),
  viewId: z.string().max(64).nullable(),
  type: z.enum(["VALIDATE_SIGN", "REQUEST_CHANGE"]),
  message: z.string().trim().max(2000).optional(),
});

export async function submitProspectAction(input: z.input<typeof actionSchema>) {
  const parsed = actionSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { slug, viewId, type, message } = parsed.data;

  const link = await getLinkForViewer(slug);
  if (!link) return { ok: false };

  const access = await getViewerAccess(link);
  if (!access.allowed) return { ok: false };

  // Only attach the view if it belongs to this browser
  const visitorId = (await cookies()).get(VISITOR_COOKIE)?.value;
  const view = viewId
    ? await prisma.documentView.findFirst({
        where: { id: viewId, linkId: link.id, visitorId },
        select: { id: true },
      })
    : null;

  const prospect = access.email
    ? await prisma.prospect.findUnique({
        where: { linkId_email: { linkId: link.id, email: access.email } },
        select: { id: true },
      })
    : null;

  const closed = link.dealStatus === "WON" || link.dealStatus === "LOST";

  await prisma.$transaction([
    prisma.prospectAction.create({
      data: {
        linkId: link.id,
        viewId: view?.id,
        prospectId: prospect?.id,
        type,
        message: message || null,
      },
    }),
    ...(closed
      ? []
      : [
          prisma.link.update({
            where: { id: link.id },
            data: { dealStatus: type === "VALIDATE_SIGN" ? "VALIDATED" : "CHANGE_REQUESTED" },
          }),
        ]),
  ]);

  // The prospect answered: automated follow-ups would now be off-key
  inBackground("prospect-action", async () => {
    await cancelOpenFollowups(
      link.id,
      type === "VALIDATE_SIGN" ? "Proposition validée par le prospect" : "Ajustement demandé par le prospect",
    );
    await refreshEngagementScore(link.id);
  });

  return { ok: true };
}
