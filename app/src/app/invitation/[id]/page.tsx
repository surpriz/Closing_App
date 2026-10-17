import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { InvitationResponse, SwitchAccountButton } from "@/components/auth/invitation-response";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

import { acceptInvitation, rejectInvitation } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.invitation");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

// Opening the page changes nothing: mail scanners follow links, so joining
// takes a click.
export default async function InvitationPage({ params }: PageProps<"/invitation/[id]">) {
  const { id } = await params;
  const t = await getTranslations("auth.invitation");
  const here = `/invitation/${id}`;
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(here)}`);

  const invitation = await prisma.invitation.findUnique({
    where: { id },
    select: {
      email: true,
      status: true,
      expiresAt: true,
      organization: { select: { name: true } },
      user: { select: { name: true, email: true } },
    },
  });

  if (!invitation || invitation.status !== "pending" || invitation.expiresAt < new Date()) {
    return (
      <Card title={t("invalidTitle")}>
        <p className="text-muted-foreground">{t("invalidBody")}</p>
      </Card>
    );
  }

  if (invitation.email.toLowerCase() !== session.user.email.toLowerCase()) {
    return (
      <Card title={t("otherAddressTitle")}>
        <p className="text-muted-foreground">
          {t("otherAddressBody", { current: session.user.email, invited: invitation.email })}
        </p>
        <SwitchAccountButton next={here} />
      </Card>
    );
  }

  const inviter = invitation.user.name || invitation.user.email;
  return (
    <Card title={t("inviteTitle", { inviter, workspace: invitation.organization.name })}>
      <p className="text-muted-foreground">{t("inviteBody")}</p>
      <InvitationResponse accept={acceptInvitation.bind(null, id)} reject={rejectInvitation.bind(null, id)} />
    </Card>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md animate-rise space-y-4 rounded-xl bg-card p-6 text-body ring-1 ring-foreground/85 sm:p-8">
        <h1 className="condensed text-title">{title}</h1>
        {children}
      </div>
    </main>
  );
}
