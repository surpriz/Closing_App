import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { InvitationResponse, SwitchAccountButton } from "@/components/auth/invitation-response";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

import { acceptInvitation, rejectInvitation } from "./actions";

export const metadata: Metadata = {
  title: "Invitation",
  robots: { index: false, follow: false },
};

// Opening the page changes nothing: mail scanners follow links, so joining
// takes a click.
export default async function InvitationPage({ params }: PageProps<"/invitation/[id]">) {
  const { id } = await params;
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
      <Card title="Cette invitation n'est plus valable.">
        <p className="text-muted-foreground">Demandez-en une nouvelle à votre manager.</p>
      </Card>
    );
  }

  if (invitation.email.toLowerCase() !== session.user.email.toLowerCase()) {
    return (
      <Card title="Cette invitation est pour une autre adresse.">
        <p className="text-muted-foreground">
          Vous êtes connecté avec {session.user.email}, l&apos;invitation a été envoyée à {invitation.email}.
        </p>
        <SwitchAccountButton next={here} />
      </Card>
    );
  }

  const inviter = invitation.user.name || invitation.user.email;
  return (
    <Card title={`${inviter} vous invite à rejoindre ${invitation.organization.name}.`}>
      <p className="text-muted-foreground">
        Vous suivrez vos propositions dans l&apos;espace de l&apos;équipe. Votre manager verra où en sont vos deals.
      </p>
      <InvitationResponse accept={acceptInvitation.bind(null, id)} reject={rejectInvitation.bind(null, id)} />
    </Card>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-16">
      <div className="w-full max-w-md space-y-4 rounded-xl bg-background p-6 text-sm shadow-sm ring-1 ring-border">
        <h1 className="text-lg font-medium text-balance">{title}</h1>
        {children}
      </div>
    </main>
  );
}
