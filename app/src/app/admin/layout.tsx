import type { Metadata } from "next";
import Link from "next/link";

import { AdminNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/brand/logo";
import { requirePlatformAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin();

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/admin" aria-label="Admin Clozer" className="flex shrink-0 items-center gap-2 rounded-md outline-none">
            <Logo />
            <span className="rounded-md bg-foreground px-1.5 py-0.5 text-xs font-medium text-background">Admin</span>
          </Link>
          <div className="min-w-0 flex-1">
            <AdminNav />
          </div>
          <Link href="/dashboard" className="hidden shrink-0 text-sm text-muted-foreground hover:text-foreground sm:block">
            Retour à l&apos;app
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 pt-8 pb-16 sm:px-6">{children}</main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-6 text-xs text-muted-foreground sm:px-6">
        Connecté en tant que {admin.email}
      </footer>
    </div>
  );
}
