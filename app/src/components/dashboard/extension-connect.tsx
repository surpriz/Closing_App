"use client";

import { Check, ChevronRight } from "lucide-react";
import { useState } from "react";

import {
  connectExtension,
  enableCallMomentEmails,
  revokeExtensionToken,
} from "@/app/extension/actions";
import { Button } from "@/components/ui/button";

type ChromeRuntime = {
  sendMessage: (
    id: string,
    message: unknown,
    callback: (response: unknown) => void,
  ) => void;
  lastError?: { message?: string };
};

function chromeRuntime() {
  return (globalThis as { chrome?: { runtime?: ChromeRuntime } }).chrome
    ?.runtime;
}

// Resolves true when one of our extensions took the token
function sendToExtension(id: string, message: unknown) {
  return new Promise<boolean>((resolve) => {
    const runtime = chromeRuntime();
    if (!runtime?.sendMessage) return resolve(false);
    try {
      runtime.sendMessage(id, message, (response) => {
        resolve(
          !runtime.lastError &&
            (response as { ok?: boolean } | undefined)?.ok === true,
        );
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
  const [status, setStatus] = useState<"idle" | "pending" | "done" | "missing">(
    "idle",
  );
  const [connectedId, setConnectedId] = useState<string | null>(null);

  async function connect() {
    setStatus("pending");
    const { id, token } = await connectExtension();
    const results = await Promise.all(
      extensionIds.map((extensionId) =>
        sendToExtension(extensionId, { type: "clozer:connect", token, nonce }),
      ),
    );
    const index = results.indexOf(true);
    if (index !== -1) {
      setConnectedId(extensionIds[index]);
      return setStatus("done");
    }
    // Nobody took it: don't leave a live token behind
    await revokeExtensionToken(id);
    setStatus("missing");
  }

  if (!nonce) {
    return (
      <p className="text-body text-muted-foreground">
        Ouvrez l&apos;extension Clozer dans Chrome et cliquez sur « Connecter
        Clozer » pour arriver ici.
      </p>
    );
  }

  if (status === "done") {
    return (
      <div className="space-y-4 rounded-xl bg-card p-6 ring-1 ring-foreground/85">
        <p className="flex items-center gap-2 text-heading">
          <Check className="size-4 text-success" aria-hidden />
          Clozer est connecté à Chrome
        </p>
        <p className="text-body text-muted-foreground">
          Revenez dans Gmail ou Outlook : joignez un PDF, le lien se fait tout
          seul. Vous pouvez fermer cet onglet.
        </p>
        {connectedId && <NotificationCheck extensionId={connectedId} />}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl bg-card p-6 ring-1 ring-foreground/85">
      <p className="text-body">
        L&apos;extension créera les liens dans l&apos;espace{" "}
        <strong>{account.workspace}</strong>, au nom de {account.email}.
      </p>
      {status === "missing" && (
        <p role="alert" className="text-small text-destructive">
          L&apos;extension n&apos;a pas répondu. Vérifiez qu&apos;elle est
          installée dans ce navigateur, puis réessayez depuis son bouton «
          Connecter Clozer ».
        </p>
      )}
      <Button onClick={connect} disabled={status === "pending"}>
        {status === "pending" ? "Connexion…" : "Connecter Clozer"}
      </Button>
    </div>
  );
}

/**
 * The OS can block Chrome's notifications without the extension knowing. A
 * test one just fired: whoever did not see it opens the fold and gets the
 * two steps, with emails turned on meanwhile.
 */
function NotificationCheck({ extensionId }: { extensionId: string }) {
  const [resent, setResent] = useState(false);
  const isMac =
    typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent);

  async function missed(event: React.SyntheticEvent<HTMLDetailsElement>) {
    if (event.currentTarget.open) await enableCallMomentEmails();
  }

  async function resend() {
    await sendToExtension(extensionId, { type: "clozer:test-notification" });
    setResent(true);
  }

  return (
    <details className="group border-t border-border pt-4" onToggle={missed}>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-small text-muted-foreground outline-none hover:text-foreground focus-visible:underline [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
        Je n&apos;ai pas vu la notification « Clozer est prêt »
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-body">
          Votre ordinateur bloque sans doute les notifications de Chrome. Deux
          clics pour les autoriser :
        </p>
        {isMac ? (
          <ol className="list-decimal space-y-1 pl-5 text-body text-muted-foreground">
            <li>
              Ouvrez{" "}
              <a
                className="underline"
                href="x-apple.systempreferences:com.apple.Notifications-Settings.extension"
              >
                Réglages Système › Notifications
              </a>
              .
            </li>
            <li>
              Choisissez Google Chrome, activez « Autoriser les notifications ».
            </li>
          </ol>
        ) : (
          <ol className="list-decimal space-y-1 pl-5 text-body text-muted-foreground">
            <li>Ouvrez Paramètres › Système › Notifications.</li>
            <li>Activez les notifications de Google Chrome.</li>
          </ol>
        )}
        <p className="text-small text-muted-foreground">
          En attendant, les alertes s&apos;affichent dans un bandeau en haut de
          Gmail ou Outlook, et vous les recevez aussi par email (modifiable dans
          Réglages › Être prévenu).
        </p>
        <Button variant="outline" onClick={resend}>
          {resent
            ? "Renvoyée, vous la voyez ?"
            : "Renvoyer une notification de test"}
        </Button>
      </div>
    </details>
  );
}
