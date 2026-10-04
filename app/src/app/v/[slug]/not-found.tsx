import { Link2Off } from "lucide-react";
import { headers } from "next/headers";

import { getViewerLabels, pickLocale } from "@/lib/closing/i18n/viewer";

export default async function ViewerNotFound() {
  const labels = getViewerLabels(pickLocale((await headers()).get("accept-language")));

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm animate-rise text-center">
        <span className="mx-auto mb-5 flex size-12 items-center justify-center rounded-2xl bg-card text-muted-foreground shadow-xs ring-1 ring-border">
          <Link2Off className="size-5" aria-hidden />
        </span>
        <h1 className="text-heading">{labels.notFoundTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{labels.notFoundText}</p>
      </div>
    </main>
  );
}
