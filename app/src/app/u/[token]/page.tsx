import type { Metadata } from "next";
import { headers } from "next/headers";

import { UnsubscribeForm } from "@/components/viewer/unsubscribe-form";
import { pickLocale } from "@/lib/closing/i18n/viewer";
import { findProspectByUnsubscribeToken } from "@/lib/closing/unsubscribe";
import { getUnsubscribeCopy } from "@/lib/closing/unsubscribe/copy";

import { confirmUnsubscribe } from "./actions";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

// Opening the page changes nothing: mail scanners follow links, so the
// prospect has to confirm with a click (POST).
export default async function UnsubscribePage({ params }: PageProps<"/u/[token]">) {
  const { token } = await params;
  const copy = getUnsubscribeCopy(pickLocale((await headers()).get("accept-language")));
  const prospect = await findProspectByUnsubscribeToken(token);

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-16">
      <div className="w-full max-w-sm rounded-xl bg-background p-6 text-sm shadow-sm ring-1 ring-black/5">
        <h1 className="mb-3 text-lg font-medium">{copy.pageTitle}</h1>
        {prospect ? (
          <UnsubscribeForm
            action={confirmUnsubscribe.bind(null, token)}
            email={prospect.email}
            alreadyDone={!!prospect.unsubscribedAt}
            copy={copy}
          />
        ) : (
          <p className="text-muted-foreground">{copy.pageInvalid}</p>
        )}
      </div>
    </main>
  );
}
