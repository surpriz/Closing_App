"use client";

import { LogOut, Shield, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { LocaleSwitcher } from "@/components/locale-switcher";
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
  isPlatformAdmin = false,
}: {
  name: string | null;
  email: string;
  workspace: string;
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
          <p className="truncate text-micro text-muted-foreground">{email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/settings#donnees")}>
          <ShieldCheck />
          {t("privacy")}
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
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <span className="text-micro text-muted-foreground">{t("language")}</span>
          <LocaleSwitcher className="[&_button]:px-2 [&_button]:py-0.5 [&_button]:text-micro" />
        </div>
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
