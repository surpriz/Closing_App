"use client";

import { CircleHelp, Compass, LifeBuoy, LogOut, Shield, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

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

import { openHelp } from "./open-help";

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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Mon compte"
        className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Avatar>
          <AvatarFallback className="bg-foreground text-xs font-medium text-background">
            {initials(name, email)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{workspace}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={openHelp}>
          <LifeBuoy />
          Aide et suggestions
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/faq")}>
          <CircleHelp />
          Questions fréquentes
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/bienvenue")}>
          <Compass />
          Revoir la prise en main
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/settings#donnees")}>
          <ShieldCheck />
          Données et confidentialité
        </DropdownMenuItem>
        {isPlatformAdmin && (
          <DropdownMenuItem onClick={() => router.push("/admin")}>
            <Shield />
            Admin
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <ThemeMenuItems />
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
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
