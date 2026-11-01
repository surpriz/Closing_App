import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { ActivityTimeline } from "@/components/dashboard/activity-timeline";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { ChatTranscript } from "@/components/dashboard/chat-transcript";
import { DealHeader } from "@/components/dashboard/deal/deal-header";
import {
  DealFold,
  DealSection,
} from "@/components/dashboard/deal/deal-section";
import { DealSettings } from "@/components/dashboard/deal/deal-settings";
import { loadDeal } from "@/components/dashboard/deal/load-deal";
import { DealNextAction } from "@/components/dashboard/deal/next-action";
import { MarkAsTestButton } from "@/components/dashboard/deal/mark-as-test-button";
import { SmartLinkProblemNotice } from "@/components/dashboard/deal/smart-link-problem";
import { ThermalBand } from "@/components/dashboard/deal/thermal-band";
import { DealContextForm } from "@/components/dashboard/deal-context-form";
import { DealContextSummaryDetails } from "@/components/dashboard/deal-context-details";
import { dealContextSummary } from "@/components/dashboard/deal-context-summary";
import { DealVerdict } from "@/components/dashboard/deal-verdict";
import { FollowupsPanel } from "@/components/dashboard/followups-panel";
import { ForwardTreeView } from "@/components/dashboard/forward-tree";
import { LinkCapsules } from "@/components/dashboard/link-capsules";
import { LinkTestTools } from "@/components/dashboard/link-test-tools";
import { LiveActivity } from "@/components/dashboard/live-activity";
import { PageTimeChart } from "@/components/dashboard/page-time-chart";
import { ProspectPanel } from "@/components/dashboard/prospect-panel";
import {
  RepliedNotice,
  SellerActivityForm,
  SnoozeControl,
} from "@/components/dashboard/seller-activity-form";
import { ShareReady } from "@/components/dashboard/share-ready";
import { SharedReaders } from "@/components/dashboard/shared-readers";
import { SmartLinkTemplate } from "@/components/dashboard/smart-link-template";
import { VoiceComments } from "@/components/dashboard/voice-comments";
import { WelcomeMessage } from "@/components/dashboard/welcome-message";
import { ShareMailToolTip } from "@/components/onboarding/share-mail-tool-tip";
import { capsuleUploadPrefix } from "@/lib/blob";
import { dealLabel, linkLabelSelect } from "@/lib/closing/dashboard/labels";
import type { DocType } from "@/lib/closing/documents/doc-types";
import { showsCountdown } from "@/lib/closing/expiry";
import { firstNameOf, guessMailClient } from "@/lib/closing/share/compose";
import { followupsEmptyHint } from "@/lib/closing/followups/empty-hint";
import { isOutreachAllowed } from "@/lib/outreach/flag";
import { settingsSummary } from "@/lib/closing/share/summary";
import type { SmartLinkProblem } from "@/lib/closing/shared/smart-params";
import { sequencerWebhookUrl } from "@/lib/closing/sequencer/apply";
import { testAddress } from "@/lib/closing/shared/seller-address";
import { prisma } from "@/lib/db";
import { isManagerRole } from "@/lib/roles";
import { formatDate } from "@/lib/format";
import { requireWorkspace } from "@/lib/session";
import { testToolsEnabled } from "@/lib/test-tools";

export async function generateMetadata({
  params,
}: PageProps<"/links/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { organization } = await requireWorkspace();
  const link = await prisma.link.findFirst({
    where: { id, organizationId: organization.id },
    select: linkLabelSelect,
  });
  const t = await getTranslations();
  return {
    title: link
      ? dealLabel(link, t("today.page.noRecipient"))
      : t("deal.page.metaTitleFallback"),
  };
}

/**
 * The deal page, read as the prospect's thermal report: who they are and what
 * to do now, their pages at the camera, then the verdict, the follow-ups, what
 * happened and the settings, each in its own ruled field.
 */
export default async function LinkDetailPage({
  params,
  searchParams,
}: PageProps<"/links/[id]">) {
  const { id } = await params;
  const justCreated = (await searchParams).new === "1";
  const workspace = await requireWorkspace();
  const deal = await loadDeal(id, workspace, justCreated);
  if (!deal) notFound();

  const { link, now, canEdit, url, mainProspect, settings, insight } = deal;
  const [t, tDocs, tPanel, locale, smartProblems] = await Promise.all([
    getTranslations("deal.page"),
    getTranslations("documents"),
    getTranslations("deal.followupsPanel"),
    getLocale(),
    canEdit ? loadSmartLinkProblems(link.id, link.shared, now) : [],
  ]);
  const uploadPrefix = capsuleUploadPrefix(workspace.organization.id);
  // The follow-up chip says the same thing as the follow-ups section
  const summaryOpts = { autonomy: settings.autonomy, campaign: deal.campaign?.name ?? null };
  const emptyHintKey = followupsEmptyHint({
    campaign: summaryOpts.campaign,
    followupsEnabled: link.followupsEnabled,
    shared: link.shared,
    hasEmail: !!mainProspect?.email,
  });

  const welcome = deal.welcome ? (
    <WelcomeMessage
      documentId={link.document.id}
      // A shared link speaks to everyone: the document's message is the one
      linkId={link.shared ? null : link.id}
      documentWelcome={deal.welcome.documentWelcome}
      linkWelcome={deal.welcome.linkWelcome}
      uploadPrefix={uploadPrefix}
    />
  ) : null;
  const pricingThresholdSec =
    link.hotPricingThresholdSec ?? settings.hotPricingThresholdSec;
  const signer = deal.signature
    ? (deal.signature.signerName ??
      deal.signature.prospect?.name ??
      deal.signature.prospect?.email ??
      t("theProspect"))
    : null;

  const share = deal.sharing && (
    <div className="space-y-3">
      <ShareReady
        // Remount when the server state moves: sent, contact added, settings tuned by the AI
        key={[
          !!link.draftAt,
          !!link.copiedAt,
          link.prospects.length,
          link.expiresAt?.getTime(),
          link.ctaEnabled,
        ].join("|")}
        linkId={link.id}
        url={url}
        title={deal.shareTitle}
        sent={!link.draftAt}
        copied={!!link.copiedAt}
        recipient={
          mainProspect
            ? {
                email: mainProspect.email,
                firstName: firstNameOf(mainProspect.name),
              }
            : null
        }
        mailClient={
          deal.sellerPrefs?.mailClient ??
          guessMailClient(workspace.user.email)
        }
        signature={settings.senderSignature}
        processing={deal.reading}
        summary={settingsSummary(link, now, locale, summaryOpts)}
        shared={link.shared}
        welcome={welcome}
        notice={
          link.autoSettings &&
          link.expiresAt &&
          showsCountdown(link.document.docType)
            ? t("autoNotice", {
                docType: tDocs(`docType.${link.document.docType as DocType}`),
                date: formatDate(link.expiresAt, locale),
              })
            : null
        }
        settings={deal.settingsPanel}
        opened={deal.opened}
        followupsEnabled={link.followupsEnabled}
        campaigns={isOutreachAllowed(workspace.user, workspace.organization.id)}
        mailTip={
          deal.sellerPrefs && (
            <ShareMailToolTip
              user={workspace.user}
              organizationId={workspace.organization.id}
              prefs={deal.sellerPrefs}
              returnTo={`/links/${link.id}`}
              inline
            />
          )
        }
      />
    </div>
  );
  // D1: a link just created and never read is a send screen; the report opens itself at the first read
  const foldReport = justCreated && deal.sharing && !deal.opened;
  // Reading the document polls fast and briefly; waiting for a first read polls slowly, until it comes
  const refresh = deal.sharing && (deal.reading || foldReport) && (
    <AutoRefresh intervalMs={deal.reading ? 3000 : 15000} />
  );

  // The follow-up to approve is the day's action: when the next action says so, it comes before the report
  const followupsFirst = deal.nextAction.kind === "review_draft";
  const followupsSection = (
    <DealSection id="relances" title={t("followupsTitle")}>
      <div className="pt-4">
        <FollowupsPanel
          followups={deal.followupItems}
          seller={settings.senderName}
          mailClient={deal.sellerPrefs?.mailClient ?? guessMailClient(workspace.user.email)}
          emptyHint={
            emptyHintKey
              ? tPanel(emptyHintKey, { name: deal.campaign?.name ?? "" })
              : null
          }
        />
      </div>
    </DealSection>
  );

  return (
    <div className="space-y-10">
      {share}
      {refresh}

      {foldReport ? (
        <p className="flex flex-wrap gap-x-6 gap-y-1 border-b border-border pb-2 font-mono text-micro text-muted-foreground">
          <span className="text-foreground">{t("foldedReportLabel")}</span>
          <span>{t("foldedReportHint")}</span>
          <Link href={`/links/${link.id}`} className="underline underline-offset-2 hover:text-foreground">
            {t("foldedReportOpen")}
          </Link>
        </p>
      ) : (
      <>
      <div className="space-y-6">
        <DealHeader deal={deal} />
        {link.parentLinkId && <p className="text-small text-muted-foreground">{t("readerLinkNote")}</p>}
        {canEdit && link.parentLinkId && !link.isOnboardingTest && <MarkAsTestButton linkId={link.id} />}
        <SmartLinkProblemNotice
          problems={smartProblems}
          linkId={link.id}
          documentId={link.document.id}
          convertible={!link.prospects.some((prospect) => prospect.origin === "SELLER")}
        />
        {/* Not sent yet: the share screen above is the next action */}
        {!link.draftAt && (
          <DealNextAction
            linkId={link.id}
            url={url}
            shareTitle={deal.shareTitle}
            action={deal.nextAction}
            cta={deal.cta}
            canEdit={canEdit}
            insight={insight}
            recipientName={deal.recipientName}
            signature={
              canEdit &&
              link.dealStatus === "VALIDATED" &&
              deal.signature &&
              signer
                ? { by: signer, at: deal.signature.createdAt }
                : null
            }
            now={now}
          />
        )}
        {canEdit && link.repliedAt && link.followupsEnabled && (
          <RepliedNotice linkId={link.id} repliedAt={link.repliedAt.toISOString()} />
        )}
      </div>

      {/* Disables every form and button below for a read-only visit */}
      <fieldset disabled={!canEdit} className="min-w-0 space-y-12">
        {followupsFirst && followupsSection}
        <LiveActivity
          key={deal.live.stamp}
          linkId={link.id}
          initial={deal.live}
          pageCount={
            link.document.kind === "URL" ? null : link.document.pages.length
          }
          video={deal.isVideo}
        />

        {deal.plates && (
          <ThermalBand
            plates={deal.plates}
            opened={deal.opened}
            video={deal.isVideo}
          >
            {deal.showsDetail && (
              <DealFold
                title={t("pageTimeTitle")}
                hint={
                  deal.isVideo ? t("pageTimeHintVideo") : t("pageTimeHint")
                }
              >
                <PageTimeChart data={deal.chartData} video={deal.isVideo} />
              </DealFold>
            )}
          </ThermalBand>
        )}

        <div className="grid grid-cols-1 gap-x-12 gap-y-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-12">
            <DealVerdict
              linkId={link.id}
              insight={insight}
              score={deal.score}
              opened={deal.opened}
              aiAvailable={deal.aiAvailable}
              readSince={
                !!insight &&
                !!link.lastActivityAt &&
                link.lastActivityAt > insight.createdAt
              }
              now={now}
              scoreGuide={{
                hasPages: link.document.kind !== "URL",
                hasPricing: link.document.pages.some((page) =>
                  page.tags.includes("PRICING"),
                ),
                pricingThresholdSec,
              }}
            />

            {!followupsFirst && followupsSection}

            {deal.transcript.length > 0 && (
              <DealSection
                id="questions"
                title={t("questionsTitle")}
                hint={t("questionsHint")}
              >
                <ChatTranscript conversations={deal.transcript} />
              </DealSection>
            )}

            {deal.voiceComments.length > 0 && (
              <DealSection
                id="vocaux"
                title={t("voiceTitle")}
                hint={t("voiceHint")}
              >
                <VoiceComments comments={deal.voiceComments} />
              </DealSection>
            )}

            {!link.shared &&
              (deal.forwardTree.hasForwards ||
                deal.forwardTree.offClozer.length > 0) && (
                <DealSection
                  id="circuit"
                  title={t("circuitTitle")}
                  hint={t("circuitHint")}
                >
                  <ForwardTreeView tree={deal.forwardTree} now={now} />
                </DealSection>
              )}

            <DealSection id="activite" title={t("activityTitle")}>
              <div className="pt-4 pl-3">
                <ActivityTimeline items={deal.timeline} />
              </div>
            </DealSection>
          </div>

          <aside className="min-w-0 space-y-12">
            {link.shared ? (
              <>
                <DealSection
                  id="lecteurs"
                  title={t("readersTitle")}
                  hint={t("readersHint")}
                >
                  <SharedReaders readers={deal.sharedReaders} />
                </DealSection>
                {canEdit && (
                  <DealSection
                    title={t("smartLinkTitle")}
                    hint={t("smartLinkHint")}
                  >
                    <SmartLinkTemplate
                      url={url}
                      linkId={link.id}
                      followupsEnabled={link.followupsEnabled}
                      repliesWebhookUrl={await sequencerWebhookUrl(link.organizationId).catch(() => null)}
                      canRotate={isManagerRole(workspace.role)}
                      testUrl={`${url}?email=${encodeURIComponent(testAddress(workspace.user.email))}`}
                    />
                  </DealSection>
                )}
              </>
            ) : (
              <DealSection
                id="prospect"
                title={t("prospectTitle")}
                hint={t("prospectHint")}
              >
                <ProspectPanel
                  linkId={link.id}
                  prospects={link.prospects}
                  map={deal.readerMap}
                  now={now}
                />
              </DealSection>
            )}

            <DealSection
              id="noter"
              title={t("logTitle")}
              hint={t("logHint")}
            >
              <SellerActivityForm linkId={link.id} />
            </DealSection>

            <DealContextSummaryDetails
              summary={dealContextSummary(
                {
                  amountCents: link.dealAmountCents,
                  currency: link.dealCurrency,
                  decisionDeadline: link.decisionDeadline,
                  decisionMakerName: link.decisionMakerName,
                  decisionMakerRole: link.decisionMakerRole,
                },
                locale,
                await getTranslations("deal.dealContextSummary"),
              )}
              paused={!!link.snoozedUntil && link.snoozedUntil > now}
            >
              <div className="divide-y divide-border">
                <DealContextForm
                  linkId={link.id}
                  initial={{
                    // Not updatedAt: it moves on every tracking flush and the page refreshes itself
                    version: [
                      link.dealAmountCents,
                      link.dealCurrency,
                      link.decisionDeadline?.getTime(),
                      link.decisionMakerName,
                      link.decisionMakerRole,
                      link.sellerNotes,
                      !!link.referenceConsentAt,
                    ].join("|"),
                    dealAmount:
                      link.dealAmountCents !== null
                        ? String(link.dealAmountCents / 100)
                        : "",
                    dealCurrency: link.dealCurrency ?? "EUR",
                    decisionDeadline:
                      link.decisionDeadline?.toISOString().slice(0, 10) ?? "",
                    decisionMakerName: link.decisionMakerName ?? "",
                    decisionMakerRole: link.decisionMakerRole ?? "",
                    sellerNotes: link.sellerNotes ?? "",
                    referenceConsent: !!link.referenceConsentAt,
                  }}
                />
                <SnoozeControl
                  linkId={link.id}
                  snoozedUntil={
                    link.snoozedUntil && link.snoozedUntil > now
                      ? link.snoozedUntil.toISOString()
                      : null
                  }
                />
              </div>
            </DealContextSummaryDetails>
          </aside>
        </div>

        {canEdit && (
          <DealSettings
            summary={settingsSummary(link, now, locale, summaryOpts)}
            name={link.name ?? ""}
            panel={deal.settingsPanel}
            welcome={!deal.sharing ? welcome : null}
            capsules={
              deal.linkCapsules.length > 0 ? (
                <LinkCapsules
                  documentId={link.document.id}
                  linkId={link.id}
                  pages={link.document.pages}
                  capsules={deal.linkCapsules}
                  canEdit={canEdit}
                  uploadPrefix={uploadPrefix}
                />
              ) : null
            }
          />
        )}
        {!canEdit && deal.linkCapsules.length > 0 && (
          <DealSection
            id="capsules"
            title={t("capsulesTitle")}
            hint={t("capsulesHint")}
          >
            <LinkCapsules
              documentId={link.document.id}
              linkId={link.id}
              pages={link.document.pages}
              capsules={deal.linkCapsules}
              canEdit={canEdit}
              uploadPrefix={uploadPrefix}
            />
          </DealSection>
        )}

        {testToolsEnabled() && <LinkTestTools linkId={link.id} />}
      </fieldset>
      </>
      )}
    </div>
  );
}

/**
 * What still applies, seen in the last week: a personal link once converted has
 * no address to ignore any more, and a fixed tool stops showing up.
 */
async function loadSmartLinkProblems(linkId: string, shared: boolean, now: Date) {
  const alerts = await prisma.sellerAlert.findMany({
    where: { linkId, type: "SMART_LINK_PROBLEM", createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
    orderBy: { createdAt: "desc" },
    select: { payload: true, createdAt: true },
  });
  // The latest of each kind
  const seen = new Set<SmartLinkProblem>();
  return alerts.flatMap((alert) => {
    const payload = alert.payload as { smartProblem?: SmartLinkProblem; tag?: string | null };
    const applies = payload.smartProblem === (shared ? "unresolved_tag" : "personal_link");
    if (!payload.smartProblem || !applies || seen.has(payload.smartProblem)) return [];
    seen.add(payload.smartProblem);
    return [{ kind: payload.smartProblem, tag: payload.tag ?? null, at: alert.createdAt }];
  });
}
