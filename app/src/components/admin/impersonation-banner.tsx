import { stopImpersonating } from "@/app/admin/impersonation-actions";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/session";

/** Shown on every app page while the platform admin is signed in as someone else. */
export async function ImpersonationBanner() {
  const session = await getSession();
  if (!session?.session.impersonatedBy) return null;

  return (
    <div className="bg-warning/15 text-sm">
      <form
        action={stopImpersonating}
        className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6"
      >
        <span>
          Vous êtes connecté en tant que <span className="font-medium">{session.user.email}</span>.
        </span>
        <Button type="submit" size="sm" variant="outline">
          Revenir à l&apos;admin
        </Button>
      </form>
    </div>
  );
}
