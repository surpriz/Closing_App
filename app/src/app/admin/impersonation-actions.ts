"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getSession } from "@/lib/session";

/** Back to the admin's own session, on the page of the user just visited. */
export async function stopImpersonating() {
  const session = await getSession();
  if (!session?.session.impersonatedBy) redirect("/dashboard");
  const userId = session.user.id;
  await auth.api.stopImpersonating({ headers: await headers() });
  redirect(`/admin/users/${userId}`);
}
