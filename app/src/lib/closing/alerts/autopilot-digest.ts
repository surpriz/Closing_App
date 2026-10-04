import { getPublicAppUrl } from "@/lib/app-origin";
import { prisma } from "@/lib/db";
import { isEmailConfigured, sendEmail, textToHtml } from "@/lib/email";
import { getEnv } from "@/lib/env";

import { DAY_MS } from "../constants";
import { getLocalParts } from "../scheduling/business-hours";

/** Morning hour (workspace time zone) the digest goes out after. */
const DIGEST_HOUR = 8;

/**
 * Once a day, tells autopilot workspaces what Clozer sent on their behalf
 * without them reading it, and what still waits for them. Nothing sent and
 * nothing waiting: no email.
 */
export async function sendAutopilotDigests(now = new Date()) {
  if (!isEmailConfigured()) return 0;
  const timezone = getEnv().DEFAULT_TIMEZONE;
  if (getLocalParts(now, timezone).hour < DIGEST_HOUR) return 0;

  const workspaces = await prisma.workspaceSettings.findMany({
    where: {
      autonomy: "AUTOPILOT",
      OR: [{ lastDigestAt: null }, { lastDigestAt: { lte: new Date(now.getTime() - 20 * 60 * 60 * 1000) } }],
    },
    select: { organizationId: true, alertEmail: true },
    take: 50,
  });

  let sent = 0;
  for (const workspace of workspaces) {
    const since = new Date(now.getTime() - DAY_MS);
    const [autoSent, drafts, owner] = await Promise.all([
      prisma.followup.findMany({
        where: {
          link: { organizationId: workspace.organizationId },
          status: { in: ["SENT", "DELIVERED"] },
          sentVia: "PLATFORM",
          approvedAt: null,
          sentAt: { gte: since },
        },
        orderBy: { sentAt: "asc" },
        select: {
          subject: true,
          channel: true,
          linkId: true,
          prospect: { select: { name: true, email: true, company: true } },
        },
      }),
      prisma.followup.count({ where: { link: { organizationId: workspace.organizationId, archivedAt: null }, status: "DRAFT" } }),
      prisma.member.findFirst({
        where: { organizationId: workspace.organizationId, role: "owner" },
        select: { user: { select: { email: true } } },
      }),
    ]);

    // Marked first: a failing email must not retry every five minutes
    await prisma.workspaceSettings.update({
      where: { organizationId: workspace.organizationId },
      data: { lastDigestAt: now },
    });

    const to = workspace.alertEmail ?? owner?.user.email;
    if (!to || (autoSent.length === 0 && drafts === 0)) continue;

    const appUrl = getPublicAppUrl();
    const lines = autoSent.map((f) => {
      const who = f.prospect.company ?? f.prospect.name ?? f.prospect.email;
      return `- ${who} : ${f.subject ?? "message WhatsApp"} (${appUrl}/links/${f.linkId})`;
    });
    const text = [
      autoSent.length
        ? `Clozer a envoyé ${autoSent.length} relance${autoSent.length > 1 ? "s" : ""} pour vous depuis hier :`
        : "Aucune relance n'est partie toute seule depuis hier.",
      ...lines,
      "",
      drafts ? `${drafts} relance${drafts > 1 ? "s attendent" : " attend"} votre accord : ${appUrl}/dashboard` : "",
      `Pour tout valider vous-même : ${appUrl}/settings`,
    ]
      .filter((line) => line !== null)
      .join("\n");

    try {
      await sendEmail({
        to,
        subject: autoSent.length ? `Clozer a relancé ${autoSent.length} prospect${autoSent.length > 1 ? "s" : ""} pour vous` : "Relances à valider",
        text,
        html: textToHtml(text),
      });
      sent++;
    } catch (error) {
      console.error(`[digest] not sent to workspace ${workspace.organizationId}`, error);
    }
  }
  return sent;
}
