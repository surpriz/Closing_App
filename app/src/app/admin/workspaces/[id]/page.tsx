import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AuditList } from "@/components/admin/audit-list";
import { AdminSection } from "@/components/admin/section";
import { UserStatusBadge, WorkspaceStatusBadge } from "@/components/admin/status-badge";
import { WorkspaceActions } from "@/components/admin/workspace-actions";
import { WorkspaceBillingForm } from "@/components/admin/workspace-billing";
import { loadAuditEntries } from "@/lib/admin/audit";
import { adminDate, adminDateTime, adminRoleLabel, formatMicroUsd } from "@/lib/admin/format";
import { loadBlockedEmails, statusOf } from "@/lib/admin/users";
import { aiCostLast30Days, PLAN_SOURCE_LABELS } from "@/lib/admin/workspaces";
import { planFor } from "@/lib/billing/workspace-plan";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Espace" };

export default async function AdminWorkspacePage({ params }: PageProps<"/admin/workspaces/[id]">) {
  await requirePlatformAdmin();
  const { id } = await params;
  const workspace = await prisma.organization.findUnique({
    where: { id },
    include: {
      members: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, email: true, name: true, banned: true, banExpires: true } } },
      },
      _count: { select: { links: true, documents: true } },
    },
  });
  if (!workspace) notFound();

  const [blockedEmails, costs, journal] = await Promise.all([
    loadBlockedEmails(),
    aiCostLast30Days([workspace.id]),
    loadAuditEntries({ targetType: "organization", targetId: workspace.id }),
  ]);
  const blocked = new Set(blockedEmails);
  const suspended = workspace.suspendedAt !== null;
  const billing = planFor(workspace);

  return (
    <>
      <div className="space-y-3">
        <Link
          href="/admin/workspaces"
          className="inline-flex items-center gap-1.5 text-small text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Espaces
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-title condensed">{workspace.name}</h1>
          <WorkspaceStatusBadge suspended={suspended} />
        </div>
        <p className="text-small text-muted-foreground">
          Créé le {adminDate.format(workspace.createdAt)} · plan {billing.plan} ({PLAN_SOURCE_LABELS[billing.source]}) · {workspace._count.documents}{" "}
          documents · {workspace._count.links} liens · IA 30 j {formatMicroUsd(costs.get(workspace.id) ?? 0)}
        </p>
        {suspended && workspace.suspendedAt && (
          <p className="text-body">
            Suspendu le {adminDateTime.format(workspace.suspendedAt)}
            {workspace.suspendedReason && <> : « {workspace.suspendedReason} »</>}
          </p>
        )}
        <WorkspaceActions id={workspace.id} name={workspace.name} suspended={suspended} />
      </div>

      <AdminSection title="Membres">
        <ul className="divide-y divide-border">
          {workspace.members.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-4 px-5 py-3 text-body">
              <div className="min-w-0">
                <Link href={`/admin/users/${member.user.id}`} className="font-medium hover:underline">
                  {member.user.email}
                </Link>
                <p className="truncate text-small text-muted-foreground">{member.user.name}</p>
              </div>
              <span className="flex shrink-0 items-center gap-3 text-muted-foreground">
                {adminRoleLabel(member.role)}
                <UserStatusBadge status={statusOf(member.user, blocked)} />
              </span>
            </li>
          ))}
        </ul>
      </AdminSection>

      <AdminSection title="Facturation">
        <dl className="grid gap-x-6 gap-y-1 px-5 py-4 text-body sm:grid-cols-2">
          <div>
            <dt className="inline text-muted-foreground">En vigueur : </dt>
            <dd className="inline">
              {billing.plan} ({PLAN_SOURCE_LABELS[billing.source]}
              {billing.endsAt && <> jusqu&apos;au {adminDate.format(billing.endsAt)}</>})
            </dd>
          </div>
          <div>
            <dt className="inline text-muted-foreground">Abonnement : </dt>
            <dd className="inline">
              {workspace.planStatus
                ? `${workspace.plan} · ${workspace.planStatus}${workspace.seats ? ` · ${workspace.seats} sièges` : ""}${workspace.billingInterval ? ` · ${workspace.billingInterval === "year" ? "annuel" : "mensuel"}` : ""}`
                : "aucun"}
            </dd>
          </div>
          <div>
            <dt className="inline text-muted-foreground">Essai : </dt>
            <dd className="inline">{workspace.trialEndsAt ? `jusqu'au ${adminDate.format(workspace.trialEndsAt)}` : "aucun"}</dd>
          </div>
          <div>
            <dt className="inline text-muted-foreground">Bêta : </dt>
            <dd className="inline">{workspace.betaGrace ? "oui" : "non"}</dd>
          </div>
          {workspace.stripeCustomerId && (
            <div>
              <a
                href={`https://dashboard.stripe.com/customers/${workspace.stripeCustomerId}`}
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
              >
                Client Stripe ↗
              </a>
            </div>
          )}
        </dl>
        <WorkspaceBillingForm id={workspace.id} />
      </AdminSection>

      <AdminSection title="Journal">
        <AuditList entries={journal} />
      </AdminSection>
    </>
  );
}
