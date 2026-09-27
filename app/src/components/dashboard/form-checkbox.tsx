"use client";

import { Checkbox } from "@/components/ui/checkbox";

type Props = {
  name: string;
  label: string;
  defaultChecked: boolean;
  value?: string;
  hint?: string;
};

export function FormCheckbox({ name, label, defaultChecked, value, hint }: Props) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
      <Checkbox name={name} value={value} defaultChecked={defaultChecked} className="mt-0.5" />
      <span>
        {label}
        {hint && <span className="block text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}
