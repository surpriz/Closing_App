import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ApproveAllButton, ApproveDraftButton } from "@/components/dashboard/drafts/approve-buttons";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { dealLabel, linkLabelSelect } from "@/lib/closing/dashboard/labels";
import { sellerLinks } from "@/lib/closing/dashboard/queries";
import { isLinkExpired } from "@/lib/closing/expiry";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("drafts");
  return { title: t("metaTitle") };
}

/**
 * Copilot without the clicks: every follow-up waiting for the seller, on one page, approved one by
 * one or all at once. The morning digest links here.
 */
export default async function DraftsPage() {
  const workspace = await requireWorkspace("/drafts");
  const t = await getTranslations("drafts");
  const tl = await getTranslations("labels");
  const noRecipient = (await getTranslations("today.page"))("noRecipient");
  const now = new Date();

  const drafts = await prisma.followup.findMany({
    where: { status: "DRAFT", link: { organizationId: workspace.organization.id, ...sellerLinks(workspace.scope) } },
    orderBy: { scheduledFor: "asc" },
    take: 100,
    select: {
      id: true,
      trigger: true,
      channel: true,
      subject: true,
      body: true,
      rationale: true,
      error: true,
      prospect: { select: { name: true, email: true } },
      link: { select: { ...linkLabelSelect, expiresAt: true } },
    },
  });
  const approvable = drafts.filter((draft) => !isLinkExpired(draft.link, now)).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        description={t("description")}
        action={approvable > 1 ? <ApproveAllButton count={approvable} /> : null}
      />
      {drafts.length === 0 ? (
        <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <ul className="divide-y divide-border border-y border-foreground bg-card">
          {drafts.map((draft) => {
            const expired = isLinkExpired(draft.link, now);
            return (
              <li key={draft.id} className="space-y-3 px-4 py-5 sm:px-6">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="min-w-0">
                    <Link href={`/links/${draft.link.id}#relances`} className="font-semibold hover:underline">
                      {dealLabel(draft.link, noRecipient)}
                    </Link>
                    <span className="text-small text-muted-foreground">
                      {" · "}
                      {tl(`followupTrigger.${draft.trigger}`)} · {tl(`channel.${draft.channel}`)} ·{" "}
                      {draft.prospect.name ?? draft.prospect.email}
                    </span>
                  </p>
                  {expired ? (
                    <span className="text-small text-destructive">{t("expired")}</span>
                  ) : (
                    <ApproveDraftButton followupId={draft.id} />
                  )}
                </div>
                {draft.rationale && <p className="text-small text-muted-foreground">{draft.rationale}</p>}
                {draft.subject && <p className="text-small font-medium">{draft.subject}</p>}
                <p className="line-clamp-6 text-small whitespace-pre-line">{draft.body}</p>
                {draft.error && <p className="text-small text-warning">{draft.error}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
