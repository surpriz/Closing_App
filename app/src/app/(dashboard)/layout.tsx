import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { CommandMenu, type CommandEntry } from "@/components/dashboard/command-menu";
import { DashboardNav, MobileNav } from "@/components/dashboard/dashboard-nav";
import { UserMenu } from "@/components/dashboard/user-menu";
import { linkLabelSelect, prospectLabel } from "@/lib/closing/dashboard/labels";
import { sellerLinks } from "@/lib/closing/dashboard/queries";
import { prisma } from "@/lib/db";
import { isManagerRole } from "@/lib/roles";
import { requireWorkspace } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, organization, role, scope } = await requireWorkspace();
  const isManager = isManagerRole(role);

  const [links, documents] = await Promise.all([
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
      select: { ...linkLabelSelect, document: { select: { name: true } } },
    }),
    prisma.document.findMany({
      where: { organizationId: organization.id, archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, name: true },
    }),
  ]);
  const entries: CommandEntry[] = [
    ...links.map((link) => {
      const contact = link.prospects[0];
      const label = prospectLabel(link);
      const who = contact?.name ?? contact?.email;
      return {
        kind: "deal" as const,
        href: `/links/${link.id}`,
        label,
        hint: [who !== label ? who : null, link.document.name].filter(Boolean).join(" · "),
      };
    }),
    ...documents.map((doc) => ({ kind: "document" as const, href: `/documents/${doc.id}`, label: doc.name })),
  ];

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link
            href="/dashboard"
            aria-label="Clozer, aujourd'hui"
            className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <Logo />
          </Link>
          <DashboardNav isManager={isManager} />
          <div className="ml-auto flex items-center gap-2">
            <CommandMenu entries={entries} />
            <UserMenu name={user.name} email={user.email} workspace={organization.name} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-28 sm:px-6 sm:pt-10 sm:pb-16">
        {children}
      </main>
      <MobileNav isManager={isManager} />
    </div>
  );
}
