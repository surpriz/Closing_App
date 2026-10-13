import type { Metadata } from "next";
import Link from "next/link";

import { AdminNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/brand/logo";
import { requirePlatformAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false },
};

// Each page calls requirePlatformAdmin too: a layout is not re-run on every navigation
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin();

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-foreground bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-stretch gap-4 px-4 sm:px-6">
          <Link href="/admin" aria-label="Admin Clozer" className="flex shrink-0 items-center gap-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
            <Logo />
            <span className="rounded-sm bg-foreground px-1.5 py-0.5 text-micro font-semibold text-background">Admin</span>
          </Link>
          <div className="min-w-0 flex-1">
            <AdminNav />
          </div>
          <Link href="/dashboard" className="hidden shrink-0 items-center text-small text-muted-foreground transition-colors hover:text-foreground sm:flex">
            Retour à l&apos;app
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 pt-8 pb-16 sm:px-6">{children}</main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-6 font-mono text-micro text-muted-foreground sm:px-6">
        Connecté en tant que {admin.email}
      </footer>
    </div>
  );
}
