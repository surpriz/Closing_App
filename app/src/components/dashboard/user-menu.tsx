"use client";

import { CreditCard, LogOut, Shield, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { LocaleMenuItems } from "@/components/dashboard/locale-menu";
import { ThemeMenuItems } from "@/components/theme/theme-menu-items";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { BILLING_HREF } from "@/lib/billing/plans";

function initials(name: string | null, email: string) {
  const source = name?.trim() || email.split("@")[0];
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}

export function UserMenu({
  name,
  email,
  workspace,
  plan,
  isPlatformAdmin = false,
}: {
  name: string | null;
  email: string;
  workspace: string;
  /** The plan in force, by name. */
  plan: string;
  isPlatformAdmin?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const t = useTranslations("nav.userMenu");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("account")}
        className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        <Avatar>
          <AvatarFallback className="bg-foreground text-micro font-semibold text-background">
            {initials(name, email)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="px-2 py-1.5">
          <p className="truncate text-small font-semibold">{workspace}</p>
          <p className="truncate text-micro text-muted-foreground">{plan}</p>
          <p className="truncate text-micro text-muted-foreground">{email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            // Already on the settings: a client push fires no hashchange, the fold would stay shut
            if (window.location.pathname.replace(/\/$/, "") !== "/settings") return router.push("/settings#donnees");
            if (window.location.hash === "#donnees") window.dispatchEvent(new HashChangeEvent("hashchange"));
            else window.location.hash = "donnees";
          }}
        >
          <ShieldCheck />
          {t("privacy")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            if (window.location.pathname.replace(/\/$/, "") !== "/settings") return router.push(BILLING_HREF);
            document.getElementById("facturation")?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          <CreditCard />
          {t("billing")}
        </DropdownMenuItem>
        {isPlatformAdmin && (
          <DropdownMenuItem onClick={() => router.push("/admin")}>
            <Shield />
            {t("admin")}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <ThemeMenuItems />
        <DropdownMenuSeparator />
        <LocaleMenuItems />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await authClient.signOut();
              router.push("/login");
              router.refresh();
            })
          }
        >
          <LogOut />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
