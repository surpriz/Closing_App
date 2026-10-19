"use client";

import { Check, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  connectExtension,
  enableCallMomentEmails,
  revokeExtensionToken,
} from "@/app/extension/actions";
import {
  probeExtension,
  startExtensionConnect,
} from "@/components/onboarding/use-extension-state";
import { Button } from "@/components/ui/button";
import { sendToExtension } from "@/lib/extension-bridge";

export function ExtensionConnect({
  nonce,
  extensionIds,
  storeUrl,
  account,
}: {
  nonce: string | null;
  extensionIds: string[];
  storeUrl: string;
  account: { email: string; workspace: string };
}) {
  const t = useTranslations("settings.extensionConnect");
  const [status, setStatus] = useState<
    "idle" | "pending" | "done" | "missing" | "expired" | "restarted"
  >("idle");
  const [connectedId, setConnectedId] = useState<string | null>(null);
  const [answeringId, setAnsweringId] = useState<string | null>(null);

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
    // An extension that answers but refused the token lost the nonce: it
    // reloaded for an update, or another connect tab replaced it
    const found = await probeExtension(extensionIds);
    setAnsweringId(found.id);
    setStatus(found.id ? "expired" : "missing");
  }

  async function restart() {
    if (!answeringId) return;
    await startExtensionConnect(answeringId);
    setStatus("restarted");
  }

  if (!nonce) {
    return (
      <p className="text-body text-muted-foreground">
        {t("noNonce")}
      </p>
    );
  }

  if (status === "done") {
    return (
      <div className="space-y-4 rounded-xl bg-card p-6 ring-1 ring-foreground/85">
        <p className="flex items-center gap-2 text-heading">
          <Check className="size-4 text-success" aria-hidden />
          {t("doneTitle")}
        </p>
        <p className="text-body text-muted-foreground">
          {t("doneHint")}
        </p>
        {connectedId && <NotificationCheck extensionId={connectedId} />}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl bg-card p-6 ring-1 ring-foreground/85">
      <p className="text-body">
        {t.rich("account", {
          workspace: account.workspace,
          email: account.email,
          b: (chunks) => <strong>{chunks}</strong>,
        })}
      </p>
      {status === "missing" && (
        <p role="alert" className="text-small text-destructive">
          {t.rich("missing", {
            link: (chunks) => (
              <a className="underline" href={storeUrl} target="_blank" rel="noreferrer">
                {chunks}
              </a>
            ),
          })}
        </p>
      )}
      {status === "expired" && (
        <p role="alert" className="text-small text-destructive">
          {t("expired")}
        </p>
      )}
      {status === "restarted" && (
        <p className="text-small text-muted-foreground">{t("restarted")}</p>
      )}
      {status === "expired" || status === "restarted" ? (
        <Button onClick={restart} disabled={status === "restarted"}>
          {t("restart")}
        </Button>
      ) : (
        <Button onClick={connect} disabled={status === "pending"}>
          {status === "pending" ? t("connecting") : t("connect")}
        </Button>
      )}
    </div>
  );
}

/**
 * The OS can block Chrome's notifications without the extension knowing. A
 * test one just fired: whoever did not see it opens the fold and gets the
 * two steps, with emails turned on meanwhile.
 */
function NotificationCheck({ extensionId }: { extensionId: string }) {
  const t = useTranslations("settings.extensionConnect");
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
        {t("notificationMissed")}
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-body">
          {t("notificationBlocked")}
        </p>
        {isMac ? (
          <ol className="list-decimal space-y-1 pl-5 text-body text-muted-foreground">
            <li>
              {t.rich("macOpen", {
                link: (chunks) => (
                  <a
                    className="underline"
                    href="x-apple.systempreferences:com.apple.Notifications-Settings.extension"
                  >
                    {chunks}
                  </a>
                ),
              })}
            </li>
            <li>{t("macAllow")}</li>
          </ol>
        ) : (
          <ol className="list-decimal space-y-1 pl-5 text-body text-muted-foreground">
            <li>{t("windowsOpen")}</li>
            <li>{t("windowsAllow")}</li>
          </ol>
        )}
        <p className="text-small text-muted-foreground">
          {t("meanwhile")}
        </p>
        <Button variant="outline" onClick={resend}>
          {resent ? t("resent") : t("resend")}
        </Button>
      </div>
    </details>
  );
}
