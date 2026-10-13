import { Link2Off } from "lucide-react";
import { headers } from "next/headers";

import { GateFrame } from "@/components/viewer/gate-frame";
import { getViewerLabels, pickLocale } from "@/lib/closing/i18n/viewer";

export default async function ViewerNotFound() {
  const labels = getViewerLabels(pickLocale((await headers()).get("accept-language")));

  return (
    <GateFrame>
      <Link2Off className="size-5 text-muted-foreground" aria-hidden />
      <h1 className="mt-4 text-heading">{labels.notFoundTitle}</h1>
      <p className="mt-2 border-t border-foreground pt-3 text-body text-pretty text-muted-foreground">
        {labels.notFoundText}
      </p>
    </GateFrame>
  );
}
