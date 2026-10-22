import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ImpersonationBanner } from "@/components/admin/impersonation-banner";
import { IdentifySeller } from "@/components/analytics/product-analytics";
import { TrialBanner } from "@/components/billing/trial-banner";
import { UpgradeDialogHost } from "@/components/billing/upgrade-dialog";
import { Logo } from "@/components/brand/logo";
import { CommandMenu, type CommandEntry } from "@/components/dashboard/command-menu";
import { DashboardNav, MobileNav } from "@/components/dashboard/dashboard-nav";
import { HelpMenu } from "@/components/dashboard/help-menu";
import { HelpWidget } from "@/components/dashboard/help-widget";
import { UserMenu } from "@/components/dashboard/user-menu";
import { LocaleMenu } from "@/components/dashboard/locale-menu";
import { DashboardExtensionBanner } from "@/components/onboarding/dashboard-extension-banner";
import { planFor } from "@/lib/billing/workspace-plan";
import { dealDocumentMeta, dealLabel, linkLabelSelect } from "@/lib/closing/dashboard/labels";
import { sellerLinks } from "@/lib/closing/dashboard/queries";
import { prisma } from "@/lib/db";
import { isPlatformAdminEmail } from "@/lib/platform-admin";
import { isProspectingAllowed } from "@/lib/prospecting/flag";
import { isManagerRole } from "@/lib/roles";
import { requireWorkspace } from "@/lib/session";
import { UploadButton } from "@/components/dashboard/upload-dropzone";
import { documentUploadPrefix, pitchUploadPrefix } from "@/lib/blob";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, organization, role, scope } = await requireWorkspace();
  const t = await getTranslations();
  const noRecipient = t("today.page.noRecipient");
  const isManager = isManagerRole(role);
  const plan = planFor(organization);

  const [links, documents, memberCount] = await Promise.all([
    prisma.link.findMany({
      where: {
        organizationId: organization.id,
        archivedAt: null,
        draftAt: null,
        // Managers search the whole team's deals
        ...(!isManager && sellerLinks(scope)),
      },
      orderBy: { updatedAt: "desc" },
      take: 300,
      select: linkLabelSelect,
    }),
    prisma.document.findMany({
      where: { organizationId: organization.id, archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, name: true },
    }),
    prisma.member.count({ where: { organizationId: organization.id } }),
  ]);
  // Alone in the workspace, there is no team to look at: the tab waits for a second member
  const hasTeam = memberCount >= 2;
  const entries: CommandEntry[] = [
    ...links.map((link) => {
      const contact = link.prospects[0];
      const label = dealLabel(link, noRecipient);
      const who = contact?.name ?? contact?.email;
      return {
        kind: "deal" as const,
        href: `/links/${link.id}`,
        label,
        hint: [who !== label ? who : null, dealDocumentMeta(link)].filter(Boolean).join(" · "),
      };
    }),
    ...documents.map((doc) => ({ kind: "document" as const, href: `/documents/${doc.id}`, label: doc.name })),
  ];

  return (
    <div className="flex flex-1 flex-col">
      <ImpersonationBanner />
      <TrialBanner plan={plan} now={new Date()} />
      <header className="sticky top-0 z-30 border-b border-foreground bg-background">
        <div className="mx-auto flex h-14 max-w-7xl items-stretch gap-6 px-4 sm:px-6">
          <Link
            href="/dashboard"
            aria-label={t("nav.layout.homeAria")}
            className="flex items-center outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <Logo />
          </Link>
          <DashboardNav isManager={isManager} hasTeam={hasTeam} prospecting={isProspectingAllowed(user, organization.id)} />
          <div className="ml-auto flex items-center gap-2">
            <UploadButton
              uploadPrefix={documentUploadPrefix(organization.id)}
              pitchUploadPrefix={pitchUploadPrefix(organization.id)}
            />
            <CommandMenu entries={entries} />
            <LocaleMenu />
            <HelpMenu />
            <UserMenu
              name={user.name}
              email={user.email}
              workspace={organization.name}
              plan={t(`billing.plans.${plan.plan}.name`)}
              isPlatformAdmin={isPlatformAdminEmail(user.email)}
            />
          </div>
        </div>
      </header>
      <Suspense>
        <DashboardExtensionBanner user={user} organizationId={organization.id} />
      </Suspense>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-8 pb-28 sm:px-6 sm:pt-10 sm:pb-16">
        {children}
      </main>
      <MobileNav isManager={isManager} hasTeam={hasTeam} />
      <HelpWidget firstName={user.name?.trim().split(/\s+/)[0] || null} />
      <UpgradeDialogHost />
      <IdentifySeller userId={user.id} />
    </div>
  );
}
