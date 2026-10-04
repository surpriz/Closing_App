"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import { connectExtension, revokeExtensionToken } from "@/app/extension/actions";
import { Button } from "@/components/ui/button";

type ChromeRuntime = {
  sendMessage: (id: string, message: unknown, callback: (response: unknown) => void) => void;
  lastError?: { message?: string };
};

function chromeRuntime() {
  return (globalThis as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;
}

// Resolves true when one of our extensions took the token
function sendToExtension(id: string, message: unknown) {
  return new Promise<boolean>((resolve) => {
    const runtime = chromeRuntime();
    if (!runtime?.sendMessage) return resolve(false);
    try {
      runtime.sendMessage(id, message, (response) => {
        resolve(!runtime.lastError && (response as { ok?: boolean } | undefined)?.ok === true);
      });
    } catch {
      resolve(false);
    }
  });
}

export function ExtensionConnect({
  nonce,
  extensionIds,
  account,
}: {
  nonce: string | null;
  extensionIds: string[];
  account: { email: string; workspace: string };
}) {
  const [status, setStatus] = useState<"idle" | "pending" | "done" | "missing">("idle");

  async function connect() {
    setStatus("pending");
    const { id, token } = await connectExtension();
    const results = await Promise.all(
      extensionIds.map((extensionId) => sendToExtension(extensionId, { type: "clozer:connect", token, nonce })),
    );
    if (results.some(Boolean)) return setStatus("done");
    // Nobody took it: don't leave a live token behind
    await revokeExtensionToken(id);
    setStatus("missing");
  }

  if (!nonce) {
    return (
      <p className="text-body text-muted-foreground">
        Ouvrez l&apos;extension Clozer dans Chrome et cliquez sur « Connecter » pour arriver ici.
      </p>
    );
  }

  if (status === "done") {
    return (
      <div className="space-y-2 rounded-xl bg-card p-6 shadow-xs ring-1 ring-border">
        <p className="flex items-center gap-2 text-heading">
          <Check className="size-4 text-success" aria-hidden />
          Extension connectée
        </p>
        <p className="text-body text-muted-foreground">
          Vous pouvez fermer cet onglet. Joignez un PDF à un email dans Gmail ou Outlook : Clozer vous proposera
          de le remplacer par un lien.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl bg-card p-6 shadow-xs ring-1 ring-border">
      <p className="text-body">
        L&apos;extension créera les liens dans l&apos;espace <strong>{account.workspace}</strong>, au nom de{" "}
        {account.email}.
      </p>
      {status === "missing" && (
        <p role="alert" className="text-small text-destructive">
          L&apos;extension n&apos;a pas répondu. Vérifiez qu&apos;elle est installée dans ce navigateur, puis
          réessayez depuis son bouton « Connecter ».
        </p>
      )}
      <Button onClick={connect} disabled={status === "pending"}>
        {status === "pending" ? "Connexion…" : "Connecter l'extension"}
      </Button>
    </div>
  );
}
