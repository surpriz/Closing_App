import type { Metadata } from "next";
import { notFound } from "next/navigation";

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
import { ThermalBand } from "@/components/dashboard/deal/thermal-band";
import { DealContextForm } from "@/components/dashboard/deal-context-form";
import { DealContextSummaryDetails } from "@/components/dashboard/deal-context-details";
import { dealContextSummary } from "@/components/dashboard/deal-context-summary";
import { DealVerdict } from "@/components/dashboard/deal-verdict";
import { FollowupsPanel } from "@/components/dashboard/followups-panel";
import { LinkCapsules } from "@/components/dashboard/link-capsules";
import { LinkTestTools } from "@/components/dashboard/link-test-tools";
import { LiveActivity } from "@/components/dashboard/live-activity";
import { PageTimeChart } from "@/components/dashboard/page-time-chart";
import { ProspectPanel } from "@/components/dashboard/prospect-panel";
import {
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
import {
  DOC_TYPE_LABELS,
  type DocType,
} from "@/lib/closing/documents/doc-types";
import { linkTitle } from "@/lib/closing/documents/link-title";
import { showsCountdown } from "@/lib/closing/expiry";
import { firstNameOf, guessMailClient } from "@/lib/closing/share/compose";
import { settingsSummary } from "@/lib/closing/share/summary";
import { prisma } from "@/lib/db";
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
  return { title: link ? dealLabel(link) : "Prospect" };
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
  const uploadPrefix = capsuleUploadPrefix(workspace.organization.id);

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
      "Le prospect")
    : null;

  return (
    <div className="space-y-10">
      {deal.sharing && (
        <div className="space-y-3">
          <ShareReady
            // Remount when the server state moves: sent, contact added, settings tuned by the AI
            key={[
              !!link.draftAt,
              link.prospects.length,
              link.expiresAt?.getTime(),
              link.ctaEnabled,
            ].join("|")}
            linkId={link.id}
            url={url}
            title={linkTitle({
              ...link.document,
              company: mainProspect?.company,
            })}
            sent={!link.draftAt}
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
            summary={settingsSummary(link, now)}
            shared={link.shared}
            welcome={welcome}
            notice={
              link.autoSettings &&
              link.expiresAt &&
              showsCountdown(link.document.docType)
                ? `Reconnu comme « ${DOC_TYPE_LABELS[link.document.docType as DocType]} » : le prospect a jusqu'au ${formatDate(link.expiresAt)} et voit le décompte.`
                : null
            }
            settings={deal.settingsPanel}
          />
          {deal.sellerPrefs && (
            <ShareMailToolTip
              user={workspace.user}
              organizationId={workspace.organization.id}
              prefs={deal.sellerPrefs}
            />
          )}
        </div>
      )}
      {deal.sharing && deal.reading && <AutoRefresh intervalMs={3000} />}

      <div className="space-y-6">
        <DealHeader deal={deal} />
        <DealNextAction
          linkId={link.id}
          url={url}
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
      </div>

      {/* Disables every form and button below for a read-only visit */}
      <fieldset disabled={!canEdit} className="min-w-0 space-y-12">
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
                title="Temps par page en détail"
                hint={
                  deal.isVideo
                    ? "sur chaque passage de la vidéo"
                    : "total et moyenne par lecture"
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

            <DealSection id="relances" title="Relances">
              <div className="pt-4">
                <FollowupsPanel followups={deal.followupItems} />
              </div>
            </DealSection>

            {deal.transcript.length > 0 && (
              <DealSection
                id="questions"
                title="Questions du prospect"
                hint="posées à l'assistant du document"
              >
                <ChatTranscript conversations={deal.transcript} />
              </DealSection>
            )}

            {deal.voiceComments.length > 0 && (
              <DealSection
                id="vocaux"
                title="Commentaires vocaux"
                hint="laissés sur les pages du document"
              >
                <VoiceComments comments={deal.voiceComments} />
              </DealSection>
            )}

            <DealSection id="activite" title="Activité">
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
                  title="Lecteurs"
                  hint="chacun a son lien et son suivi"
                >
                  <SharedReaders readers={deal.sharedReaders} />
                </DealSection>
                {canEdit && (
                  <DealSection
                    title="Smart Link pour cold email"
                    hint="Lemlist, Instantly, Apollo…"
                  >
                    <SmartLinkTemplate url={url} />
                  </DealSection>
                )}
              </>
            ) : (
              <DealSection
                id="prospect"
                title="Prospect"
                hint="reçoit les relances, et qui a lu"
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
              title="Noter un échange"
              hint="appels, réponses, rendez-vous"
            >
              <SellerActivityForm linkId={link.id} />
            </DealSection>

            <DealContextSummaryDetails
              summary={dealContextSummary({
                amountCents: link.dealAmountCents,
                currency: link.dealCurrency,
                decisionDeadline: link.decisionDeadline,
                decisionMakerName: link.decisionMakerName,
                decisionMakerRole: link.decisionMakerRole,
              })}
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
            summary={settingsSummary(link, now)}
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
            title="Capsules par page"
            hint="enregistrées avant le mot d'accueil"
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
    </div>
  );
}
