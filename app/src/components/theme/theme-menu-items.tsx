"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

const OPTIONS = [
  { value: "light", label: "Clair", icon: Sun },
  { value: "dark", label: "Sombre", icon: Moon },
  { value: "system", label: "Système", icon: Monitor },
] as const;

/** Theme choice, meant to sit inside an open dropdown menu. */
export function ThemeMenuItems() {
  const { theme = "light", setTheme } = useTheme();

  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>Apparence</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(String(value))}>
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <DropdownMenuRadioItem key={value} value={value}>
            <Icon />
            {label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuGroup>
  );
}
