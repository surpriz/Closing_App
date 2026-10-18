import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { ToolSetup } from "@/components/onboarding/tool-setup";
import { documentUploadPrefix } from "@/lib/blob";
import { getSellerPrefs } from "@/lib/closing/notify/preferences";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { connectedClients } from "@/lib/extension-tokens";
import { parseMailClient, safeReturnTo, SAMPLE_DOCUMENT } from "@/lib/onboarding";
import { requireWorkspace } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding");
  return { title: t("metaTitle") };
}

// Opens on its own the first time a seller lands on /dashboard, and stays
// reachable from the account menu for whoever wants the tour again
export default async function WelcomePage(props: PageProps<"/welcome">) {
  const { user, organization } = await requireWorkspace("/welcome");
  const query = await props.searchParams;
  const prefs = await getSellerPrefs(user.id, organization.id);
  const firstName = user.name?.trim().split(/\s+/)[0] ?? null;

  // Plugging in the mailbox, from the share screen tip: back to that screen when done
  if (query.step === "tool") {
    const tokens = await prisma.extensionToken.findMany({
      where: { userId: user.id, organizationId: organization.id, revokedAt: null },
      select: { label: true },
    });
    return (
      <ToolSetup
        firstName={firstName}
        initialMailClient={parseMailClient(prefs.mailClient)}
        connected={connectedClients(tokens)}
        account={{ email: user.email, workspace: organization.name }}
        chromeStoreUrl={getEnv().EXTENSION_STORE_URL ?? null}
        returnTo={safeReturnTo(query.from) ?? "/dashboard"}
      />
    );
  }

  // Replaying the tour: start from the latest document instead of adding it again
  const previous = prefs.onboardingCompletedAt
    ? await prisma.document.findFirst({
        where: {
          organizationId: organization.id,
          ownerId: user.id,
          archivedAt: null,
          status: "READY",
          name: { not: SAMPLE_DOCUMENT.name },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          links: {
            where: {
              createdById: user.id,
              draftAt: { not: null },
              archivedAt: null,
              isOnboardingTest: false,
              shared: false,
            },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true },
          },
        },
      })
    : null;

  return (
    <OnboardingWizard
      firstName={firstName}
      uploadPrefix={documentUploadPrefix(organization.id)}
      previous={
        previous
          ? { documentId: previous.id, linkId: previous.links[0]?.id ?? null, name: previous.name }
          : null
      }
    />
  );
}
