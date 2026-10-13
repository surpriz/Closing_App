import type { Metadata } from "next";

import { AdminSection } from "@/components/admin/section";
import { EmailList, SignupModeForm } from "@/components/admin/signup-settings";
import { adminDate } from "@/lib/admin/format";
import { prisma } from "@/lib/db";
import { parseSignupMode } from "@/lib/platform-admin";
import { requirePlatformAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Inscriptions" };

export default async function AdminSettingsPage() {
  await requirePlatformAdmin();
  const [settings, allowed, blocked] = await Promise.all([
    prisma.platformSettings.findUnique({ where: { id: "singleton" } }),
    prisma.allowedEmail.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.blockedEmail.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <>
      <h1 className="text-title condensed">Inscriptions</h1>

      <AdminSection title="Qui peut créer un compte">
        <p className="px-5 pt-4 text-small text-muted-foreground">
          Sur invitation : seuls les emails invités dans un espace ou ajoutés ci-dessous peuvent s&apos;inscrire. Les
          comptes existants ne sont pas touchés.
        </p>
        <SignupModeForm mode={parseSignupMode(settings?.signupMode)} />
      </AdminSection>

      <AdminSection title="Emails autorisés">
        <EmailList
          kind="allowed"
          rows={allowed.map((row) => ({ email: row.email, detail: `ajouté le ${adminDate.format(row.createdAt)}` }))}
        />
      </AdminSection>

      <AdminSection title="Emails bloqués">
        <EmailList
          kind="blocked"
          rows={blocked.map((row) => ({
            email: row.email,
            detail: [row.reason, `depuis le ${adminDate.format(row.createdAt)}`].filter(Boolean).join(" · "),
          }))}
        />
      </AdminSection>
    </>
  );
}
