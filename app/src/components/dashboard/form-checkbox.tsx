type Props = {
  name: string;
  label: string;
  defaultChecked: boolean;
  value?: string;
  hint?: string;
};

export function FormCheckbox({ name, label, defaultChecked, value, hint }: Props) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 shrink-0 accent-primary"
      />
      <span>
        {label}
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}
