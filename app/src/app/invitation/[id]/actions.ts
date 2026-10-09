"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { teamErrorMessage } from "@/lib/team-errors";

export type InvitationState = { error?: string };

export async function acceptInvitation(invitationId: string): Promise<InvitationState> {
  try {
    await auth.api.acceptInvitation({ body: { invitationId }, headers: await headers() });
  } catch (error) {
    return { error: teamErrorMessage(error) };
  }
  redirect("/dashboard");
}

// With nothing left pending, the next visit creates the seller's own workspace
export async function rejectInvitation(invitationId: string): Promise<InvitationState> {
  try {
    await auth.api.rejectInvitation({ body: { invitationId }, headers: await headers() });
  } catch (error) {
    return { error: teamErrorMessage(error) };
  }
  redirect("/dashboard");
}
