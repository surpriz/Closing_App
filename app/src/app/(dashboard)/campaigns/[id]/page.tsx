import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { CampaignHeader } from "@/components/dashboard/campaigns/campaign-header";
import { CampaignSettings } from "@/components/dashboard/campaigns/campaign-settings";
import { CampaignTestTools } from "@/components/dashboard/campaigns/campaign-test-tools";
import { EnrollmentsTable } from "@/components/dashboard/campaigns/enrollments-table";
import { ForwardedContacts } from "@/components/dashboard/campaigns/forwarded-contacts";
import { ImportProspects } from "@/components/dashboard/campaigns/import-prospects";
import { MailboxBanner } from "@/components/dashboard/campaigns/mailbox-banner";
import { StepStats } from "@/components/dashboard/campaigns/step-stats";
import { StepsEditor } from "@/components/dashboard/campaigns/steps-editor";
import { SectionTitle, Surface } from "@/components/dashboard/page-header";
import type { UiLocale } from "@/i18n/locale";
import { inBackground } from "@/lib/closing/background";
import { documentTitle } from "@/lib/closing/documents/link-title";
import { canUseMailboxes } from "@/lib/billing/mailboxes";
import { prisma } from "@/lib/db";
import { canEditCampaign } from "@/lib/outreach/campaigns";
import { requireOutreach } from "@/lib/outreach/flag";
import { runOutreachTick } from "@/lib/outreach/tick";
import { isManagerRole } from "@/lib/roles";
import { testToolsEnabled } from "@/lib/test-tools";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("campaigns");
  return { title: t("metaTitle") };
}
export const maxDuration = 300;

const REFRESH_MS = 30_000;
const ENROLLMENTS_SHOWN = 200;
const FORWARDS_SHOWN = 100;

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, organization, role } = await requireOutreach();
  const now = new Date();
  const [t, locale] = await Promise.all([getTranslations("campaigns"), getLocale()]);

  const campaign = await prisma.campaign.findFirst({
    where: { id, organizationId: organization.id },
    select: {
      id: true,
      createdById: true,
      name: true,
      status: true,
      locale: true,
      linkOnReply: true,
      mailboxId: true,
      documentId: true,
      mailbox: { select: { id: true, email: true, status: true, userId: true } },
      steps: {
        orderBy: { order: "asc" },
        select: { id: true, order: true, delayDays: true, subject: true, newThread: true, body: true, carriesLink: true },
      },
    },
  });
  if (!campaign) notFound();
  const manager = isManagerRole(role);
  const canEdit = canEditCampaign(campaign, { userId: user.id, isManager: manager });

  inBackground("outreach-catch-up", () =>
    runOutreachTick(now, { organizationId: organization.id, syncBudgetMs: 15_000 }),
  );

  const [mailboxes, documents, currentDocument, enrollments, groups, sent, firstEnrollment, clicks, forwards] = await Promise.all([
    prisma.mailbox.findMany({
      where: { organizationId: organization.id, status: "ACTIVE", ...(manager ? {} : { userId: user.id }) },
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
          where: { id: campaign.documentId, organizationId: organization.id, status: "READY", archivedAt: null },
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
        lastSignal: true,
        reactivatedAt: true,
        followups: {
          where: { status: { in: ["PENDING", "DRAFT", "GENERATED", "SCHEDULED", "SENT"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true, scheduledFor: true, sentAt: true },
        },
        messages: {
          where: { sentAt: { not: null } },
          orderBy: { sentAt: "desc" },
          take: 1,
          select: { sentAt: true },
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
    prisma.campaignMessage.findMany({
      where: { campaignId: campaign.id, clickedAt: { not: null } },
      select: { enrollmentId: true },
      distinct: ["enrollmentId"],
    }),
    // E8: recipients of a forward on one of this campaign's links
    prisma.linkForward.findMany({
      where: { link: { organizationId: organization.id, campaignProspect: { campaignId: campaign.id } } },
      orderBy: { createdAt: "desc" },
      take: FORWARDS_SHOWN,
      select: { createdAt: true, toProspect: { select: { id: true, email: true, name: true, company: true } } },
    }),
  ]);

  const enrolledForwards = forwards.length
    ? new Set(
        (
          await prisma.campaignProspect.findMany({
            where: {
              campaignId: campaign.id,
              email: { in: forwards.map((forward) => forward.toProspect.email.trim().toLowerCase()) },
            },
            select: { email: true },
          })
        ).map((row) => row.email),
      )
    : new Set<string>();
  const forwardedSeen = new Set<string>();
  const forwardedContacts = forwards.flatMap((forward) => {
    const contact = forward.toProspect;
    const email = contact.email.trim().toLowerCase();
    if (enrolledForwards.has(email) || forwardedSeen.has(email)) return [];
    forwardedSeen.add(email);
    return [{ prospectId: contact.id, email, name: contact.name, company: contact.company, forwardedAt: forward.createdAt }];
  });
  const clicked = new Set(clicks.map((click) => click.enrollmentId));

  // One grouped query for the whole campaign: rows an interrupted send left FAILED with a Message-ID. A row blocks its
  // enrollment only when it is the next step, which is checked per row below.
  const failedSteps = await prisma.campaignMessage.findMany({
    where: { campaignId: campaign.id, kind: "STEP", status: "FAILED", messageId: { not: null }, enrollment: { status: "ACTIVE" } },
    select: { enrollmentId: true, stepId: true },
  });
  const blockedSteps = new Set(failedSteps.map((message) => `${message.enrollmentId}:${message.stepId}`));
  const stepIdByOrder = new Map(campaign.steps.map((step) => [step.order, step.id]));

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
    const live = enrollment.status === "QUEUED" || enrollment.status === "ACTIVE";
    return {
      id: enrollment.id,
      email: enrollment.email,
      name: [enrollment.firstName, enrollment.lastName].filter(Boolean).join(" ") || null,
      company: enrollment.company,
      status: enrollment.status,
      pausedReason: enrollment.pausedReason,
      currentStep: enrollment.currentStep,
      timezone: enrollment.timezone,
      nextAt: live ? enrollment.nextSendAt : null,
      lastAt: enrollment.messages[0]?.sentAt ?? null,
      linkId: enrollment.linkId,
      lastSignal: enrollment.lastSignal,
      reactivatedAt: enrollment.reactivatedAt,
      followup: enrollment.followups[0]
        ? {
            status: enrollment.followups[0].status,
            at: enrollment.followups[0].status === "SENT" ? enrollment.followups[0].sentAt : enrollment.followups[0].scheduledFor,
          }
        : null,
      clicked: clicked.has(enrollment.id),
      blockedStep: enrollment.status === "ACTIVE" && blockedSteps.has(`${enrollment.id}:${stepIdByOrder.get(enrollment.currentStep + 1)}`),
    };
  });

  // The mailbox select offers what the viewer may bind, plus the current one when it is a colleague's (shown, not changeable)
  const mailboxOptions =
    campaign.mailbox?.status === "ACTIVE" && !mailboxes.some((mailbox) => mailbox.id === campaign.mailbox?.id)
      ? [...mailboxes, { id: campaign.mailbox.id, email: campaign.mailbox.email }]
      : mailboxes;
  const archived = campaign.status === "ARCHIVED";
  const locked = archived || !canEdit;
  const uiLocale = locale as UiLocale;
  const planBlocked = campaign.status === "ACTIVE" && !(await canUseMailboxes(organization.id));

  return (
    <div className="space-y-10">
      {campaign.status === "ACTIVE" && <AutoRefresh intervalMs={REFRESH_MS} />}
      {planBlocked && <MailboxBanner mailboxes={[]} hasActive planBlocked />}
      <CampaignHeader
        id={campaign.id}
        name={campaign.name}
        status={campaign.status}
        counts={counts}
        canEdit={canEdit}
      />
      {!canEdit && <p className="text-small text-muted-foreground">{t("detail.readOnly")}</p>}

      <section>
        <SectionTitle>{t("settings.title")}</SectionTitle>
        <CampaignSettings
          id={campaign.id}
          name={campaign.name}
          mailboxId={campaign.mailboxId}
          documentId={campaign.documentId}
          locale={campaign.locale}
          linkOnReply={campaign.linkOnReply}
          mailboxes={mailboxOptions}
          currentMailbox={
            campaign.mailbox
              ? {
                  email: campaign.mailbox.email,
                  status: campaign.mailbox.status,
                  teammate: campaign.mailbox.userId !== user.id,
                }
              : null
          }
          documents={documentOptions}
          stepCarriesLink={campaign.steps.some((step) => step.carriesLink)}
          disabled={locked}
        />
      </section>

      <section>
        <SectionTitle>{t("steps.title")}</SectionTitle>
        <StepsEditor
          campaignId={campaign.id}
          initialSteps={campaign.steps.map((step) => ({
            order: step.order,
            delayDays: step.delayDays,
            subject: step.subject,
            newThread: step.newThread,
            body: step.body,
            carriesLink: step.carriesLink,
          }))}
          extraVars={Object.keys(extra)}
          sampleVars={sampleVars}
          sampleEmail={firstEnrollment?.email ?? null}
          canTest={campaign.mailbox?.status === "ACTIVE"}
          disabled={locked}
        />
      </section>

      <StepStats campaignId={campaign.id} />

      {!locked && (
        <section>
          <SectionTitle>{t("import.title")}</SectionTitle>
          <ImportProspects campaignId={campaign.id} />
        </section>
      )}

      {!locked && forwardedContacts.length > 0 && (
        <section>
          <SectionTitle>{t("forwarded.title")}</SectionTitle>
          <ForwardedContacts campaignId={campaign.id} contacts={forwardedContacts} locale={uiLocale} />
        </section>
      )}

      <section>
        <SectionTitle>{t("enrollments.title")}</SectionTitle>
        <Surface>
          <EnrollmentsTable
            rows={rows}
            totalSteps={campaign.steps.length}
            locale={uiLocale}
            disabled={locked}
            truncated={total > rows.length}
          />
        </Surface>
      </section>

      {testToolsEnabled() && canEdit && (
        <CampaignTestTools
          enrollments={rows.slice(0, 50).map(({ id: enrollmentId, email, linkId }) => ({ id: enrollmentId, email, hasLink: linkId !== null }))}
          mailboxId={campaign.mailboxId}
        />
      )}
    </div>
  );
}
