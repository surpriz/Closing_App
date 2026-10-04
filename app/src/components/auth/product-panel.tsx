import { Check, Eye, PenLine, Sparkles } from "lucide-react";

const ROWS = [
  { name: "Atelier Morel", action: "Appelez maintenant, elle relit les tarifs", heat: "bg-heat-hot", fill: "h-[88%]", live: true },
  { name: "Verso Studio", action: "Relance prête : relisez-la et validez", heat: "bg-heat-warm", fill: "h-[58%]" },
  { name: "Brunet & Fils", action: "Laissez-lui le temps, il a répondu hier", heat: "bg-heat-cold", fill: "h-[30%]" },
];

const BENEFITS = [
  { icon: Eye, text: "Voyez qui lit votre proposition, page par page." },
  { icon: Sparkles, text: "Sachez qui relancer aujourd'hui, et quoi lui dire." },
  { icon: PenLine, text: "Les relances s'écrivent seules. Vous validez." },
];

/** Right half of the login screen: what the product looks like, in plain HTML. */
export function ProductPanel() {
  return (
    <aside
      aria-label="Aperçu de Clozer"
      className="relative hidden overflow-hidden border-l border-border bg-muted/50 lg:flex lg:flex-col lg:justify-center lg:px-12 xl:px-20"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-40 size-[32rem] rounded-full bg-heat-hot/10 blur-3xl"
      />
      <div className="relative max-w-md space-y-10">
        <div aria-hidden className="animate-rise rounded-2xl bg-card p-2 shadow-lg ring-1 ring-border">
          <p className="px-3 pt-2 pb-3 text-sm font-semibold">
            À traiter <span className="font-normal text-muted-foreground">aujourd&apos;hui</span>
          </p>
          <ul className="stagger divide-y divide-border">
            {ROWS.map((row) => (
              <li key={row.name} className="flex gap-3 px-3 py-3">
                <span className="relative w-1 overflow-hidden rounded-full bg-foreground/[0.06]">
                  <span className={`absolute inset-x-0 bottom-0 rounded-full ${row.heat} ${row.fill}`} />
                </span>
                <div className="min-w-0 space-y-1.5">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {row.name}
                    {row.live && (
                      <span className="relative flex size-2">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-heat-hot opacity-60 motion-reduce:animate-none" />
                        <span className="relative inline-flex size-2 rounded-full bg-heat-hot" />
                      </span>
                    )}
                  </p>
                  <p className="truncate rounded-md bg-muted px-2 py-1 text-small">{row.action}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <ul className="space-y-4">
          {BENEFITS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-body">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-card shadow-xs ring-1 ring-border">
                <Icon className="size-3.5" aria-hidden />
              </span>
              <span className="pt-0.5">{text}</span>
            </li>
          ))}
        </ul>

        <p className="flex items-center gap-2 text-small text-muted-foreground">
          <Check className="size-3.5 text-success" aria-hidden />
          Par défaut, rien ne part à vos prospects sans votre accord.
        </p>
      </div>
    </aside>
  );
}
