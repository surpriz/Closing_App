import type { Metadata } from "next";
import { headers } from "next/headers";

import { GateFrame } from "@/components/viewer/gate-frame";
import { UnsubscribeForm } from "@/components/viewer/unsubscribe-form";
import { pickLocale } from "@/lib/closing/i18n/viewer";
import { findProspectByUnsubscribeToken } from "@/lib/closing/unsubscribe";
import { getUnsubscribeCopy, unsubscribePageTitle } from "@/lib/closing/unsubscribe/copy";

import { confirmUnsubscribe } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: unsubscribePageTitle((await headers()).get("accept-language")),
    robots: { index: false, follow: false },
  };
}

// Opening the page changes nothing: mail scanners follow links, so the
// prospect has to confirm with a click (POST).
export default async function UnsubscribePage({ params }: PageProps<"/u/[token]">) {
  const { token } = await params;
  const copy = getUnsubscribeCopy(pickLocale((await headers()).get("accept-language")));
  const prospect = await findProspectByUnsubscribeToken(token);

  return (
    <GateFrame>
      <h1 className="text-heading">{copy.pageTitle}</h1>
      <div className="mt-4 border-t border-foreground pt-4 text-body">
        {prospect ? (
          <UnsubscribeForm
            action={confirmUnsubscribe.bind(null, token)}
            email={prospect.email}
            alreadyDone={!!prospect.unsubscribedAt}
            copy={copy}
          />
        ) : (
          <p role="alert" className="text-muted-foreground">
            {copy.pageInvalid}
          </p>
        )}
      </div>
    </GateFrame>
  );
}
