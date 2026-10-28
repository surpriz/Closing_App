import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { CampaignHeader } from "@/components/dashboard/campaigns/campaign-header";
import { CampaignSettings } from "@/components/dashboard/campaigns/campaign-settings";
import { CampaignTestTools } from "@/components/dashboard/campaigns/campaign-test-tools";
import { EnrollmentsTable } from "@/components/dashboard/campaigns/enrollments-table";
import { ImportProspects } from "@/components/dashboard/campaigns/import-prospects";
import { StepsEditor } from "@/components/dashboard/campaigns/steps-editor";
import { SectionTitle, Surface } from "@/components/dashboard/page-header";
import type { UiLocale } from "@/i18n/locale";
import { inBackground } from "@/lib/closing/background";
import { documentTitle } from "@/lib/closing/documents/link-title";
import { prisma } from "@/lib/db";
import { requireOutreach } from "@/lib/outreach/flag";
import { runOutreachTick } from "@/lib/outreach/tick";
import { testToolsEnabled } from "@/lib/test-tools";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("campaigns");
  return { title: t("metaTitle") };
}
export const maxDuration = 300;

const REFRESH_MS = 30_000;
const ENROLLMENTS_SHOWN = 200;

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organization } = await requireOutreach();
  const now = new Date();
  const [t, locale] = await Promise.all([getTranslations("campaigns"), getLocale()]);

  const campaign = await prisma.campaign.findFirst({
    where: { id, organizationId: organization.id },
    select: {
      id: true,
      name: true,
      status: true,
      locale: true,
      linkOnReply: true,
      mailboxId: true,
      documentId: true,
      mailbox: { select: { id: true, email: true, status: true } },
      steps: {
        orderBy: { order: "asc" },
        select: { order: true, delayDays: true, subject: true, newThread: true, body: true, carriesLink: true },
      },
    },
  });
  if (!campaign) notFound();

  inBackground("outreach-catch-up", () =>
    runOutreachTick(now, { organizationId: organization.id, syncBudgetMs: 15_000 }),
  );

  const [mailboxes, documents, currentDocument, enrollments, groups, sent, firstEnrollment] = await Promise.all([
    prisma.mailbox.findMany({
      where: { organizationId: organization.id, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true },
    }),
    prisma.document.findMany({
      where: { organizationId: organization.id, status: "READY", archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, name: true, displayTitle: true, docType: true },
    }),
    campaign.documentId
      ? prisma.document.findFirst({
          where: { id: campaign.documentId, organizationId: organization.id },
          select: { id: true, name: true, displayTitle: true, docType: true },
        })
      : null,
    prisma.campaignProspect.findMany({
      where: { campaignId: campaign.id },
      orderBy: { createdAt: "desc" },
      take: ENROLLMENTS_SHOWN,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        company: true,
        status: true,
        pausedReason: true,
        currentStep: true,
        timezone: true,
        nextSendAt: true,
        linkId: true,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true, scheduledFor: true, sentAt: true, bouncedAt: true },
        },
      },
    }),
    prisma.campaignProspect.groupBy({
      by: ["status"],
      where: { campaignId: campaign.id },
      _count: { _all: true },
    }),
    prisma.campaignMessage.count({ where: { campaignId: campaign.id, status: "SENT" } }),
    // The oldest enrollment is the one the test email and the preview borrow their values from
    prisma.campaignProspect.findFirst({
      where: { campaignId: campaign.id },
      orderBy: { createdAt: "asc" },
      select: { email: true, firstName: true, lastName: true, company: true, title: true, vars: true },
    }),
  ]);

  const byStatus = new Map(groups.map((group) => [group.status, group._count._all]));
  const total = groups.reduce((sum, group) => sum + group._count._all, 0);
  const counts = {
    enrolled: total,
    sent,
    replied: byStatus.get("REPLIED") ?? 0,
    bounced: byStatus.get("BOUNCED") ?? 0,
    unsubscribed: byStatus.get("UNSUBSCRIBED") ?? 0,
  };

  const extra: Record<string, string> = {};
  if (firstEnrollment?.vars && typeof firstEnrollment.vars === "object" && !Array.isArray(firstEnrollment.vars)) {
    for (const [key, value] of Object.entries(firstEnrollment.vars)) {
      if (typeof value === "string") extra[key] = value;
    }
  }
  const sampleVars = firstEnrollment
    ? {
        email: firstEnrollment.email,
        firstName: firstEnrollment.firstName,
        lastName: firstEnrollment.lastName,
        company: firstEnrollment.company,
        title: firstEnrollment.title,
        ...extra,
      }
    : null;

  const documentOptions = [...(currentDocument && !documents.some((d) => d.id === currentDocument.id) ? [currentDocument] : []), ...documents].map(
    (document) => ({ id: document.id, title: documentTitle(document) }),
  );

  const rows = enrollments.map((enrollment) => {
    const message = enrollment.messages[0];
    const live = enrollment.status === "QUEUED" || enrollment.status === "ACTIVE";
    const pendingMessage = message && (message.status === "SCHEDULED" || message.status === "SENDING");
    return {
      id: enrollment.id,
      email: enrollment.email,
      name: [enrollment.firstName, enrollment.lastName].filter(Boolean).join(" ") || null,
      company: enrollment.company,
      status: enrollment.status,
      pausedReason: enrollment.pausedReason,
      currentStep: enrollment.currentStep,
      timezone: enrollment.timezone,
      nextAt: live ? (pendingMessage ? message.scheduledFor : enrollment.nextSendAt) : null,
      lastAt: message?.sentAt ?? null,
      linkId: enrollment.linkId,
    };
  });

  const archived = campaign.status === "ARCHIVED";
  const uiLocale = locale as UiLocale;

  return (
    <div className="space-y-10">
      {campaign.status === "ACTIVE" && <AutoRefresh intervalMs={REFRESH_MS} />}
      <CampaignHeader id={campaign.id} name={campaign.name} status={campaign.status} counts={counts} />

      <section>
        <SectionTitle>{t("settings.title")}</SectionTitle>
        <CampaignSettings
          id={campaign.id}
          name={campaign.name}
          mailboxId={campaign.mailboxId}
          documentId={campaign.documentId}
          locale={campaign.locale}
          linkOnReply={campaign.linkOnReply}
          mailboxes={mailboxes}
          currentMailbox={campaign.mailbox ? { email: campaign.mailbox.email, status: campaign.mailbox.status } : null}
          documents={documentOptions}
          stepCarriesLink={campaign.steps.some((step) => step.carriesLink)}
          disabled={archived}
        />
      </section>

      <section>
        <SectionTitle>{t("steps.title")}</SectionTitle>
        <StepsEditor
          campaignId={campaign.id}
          initialSteps={campaign.steps}
          extraVars={Object.keys(extra)}
          sampleVars={sampleVars}
          sampleEmail={firstEnrollment?.email ?? null}
          canTest={campaign.mailbox?.status === "ACTIVE"}
          disabled={archived}
        />
      </section>

      {!archived && (
        <section>
          <SectionTitle>{t("import.title")}</SectionTitle>
          <ImportProspects campaignId={campaign.id} />
        </section>
      )}

      <section>
        <SectionTitle>{t("enrollments.title")}</SectionTitle>
        <Surface>
          <EnrollmentsTable
            rows={rows}
            totalSteps={campaign.steps.length}
            locale={uiLocale}
            disabled={archived}
            truncated={total > rows.length}
          />
        </Surface>
      </section>

      {testToolsEnabled() && (
        <CampaignTestTools
          enrollments={rows.slice(0, 50).map(({ id: enrollmentId, email }) => ({ id: enrollmentId, email }))}
          mailboxId={campaign.mailboxId}
        />
      )}
    </div>
  );
}
