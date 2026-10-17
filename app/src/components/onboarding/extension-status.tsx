"use client";

import { Button } from "@/components/ui/button";
import type { ExtensionProbe, ExtensionState } from "@/lib/onboarding";

import { startExtensionConnect, updateExtension, useExtensionState } from "./use-extension-state";

const LABELS: Record<Exclude<ExtensionState, "ok">, string> = {
  absent: "pas installée",
  signed_out: "installée, pas connectée",
  other_account: "connectée à un autre compte",
  outdated: "à mettre à jour",
};

/** "Sur ce navigateur : …", under the Chrome card. Nothing outside desktop Chromium. */
export function ExtensionStatus({ probe }: { probe: ExtensionProbe }) {
  const { state, reply, extensionId } = useExtensionState(probe);
  if (!state) return null;

  let label: string;
  if (state === "ok") label = reply ? `connectée, version ${reply.version}` : "connectée";
  else if (state === "other_account" && reply?.email) label = `connectée à ${reply.email}`;
  else label = LABELS[state];

  return (
    <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
      <p className="text-small text-muted-foreground">Sur ce navigateur : {label}.</p>
      {extensionId && (state === "signed_out" || state === "other_account") && (
        <Button size="sm" variant="outline" onClick={() => startExtensionConnect(extensionId)}>
          Connecter
        </Button>
      )}
      {extensionId && state === "outdated" && (
        <Button size="sm" variant="outline" onClick={() => updateExtension(extensionId)}>
          Mettre à jour
        </Button>
      )}
    </div>
  );
}
