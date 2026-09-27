import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { DashboardNav, MobileNav } from "@/components/dashboard/dashboard-nav";
import { UserMenu } from "@/components/dashboard/user-menu";
import { requireWorkspace } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, organization } = await requireWorkspace();

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 sm:px-6">
          <Link
            href="/dashboard"
            aria-label="Clozer, aujourd'hui"
            className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Logo />
          </Link>
          <DashboardNav />
          <div className="ml-auto">
            <UserMenu name={user.name} email={user.email} workspace={organization.name} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-10 pb-28 sm:px-6 sm:pb-16">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
