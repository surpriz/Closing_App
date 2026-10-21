import { isAPIError } from "better-auth/api";
import { getTranslations } from "next-intl/server";

// Better Auth's organization errors, as a seller should read them (server.team in the messages)
const CODES = [
  "USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION",
  "YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION",
  "YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE",
  "YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_MEMBER",
  "YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_MEMBER",
  "YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER",
  "YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER",
  "YOU_ARE_NOT_ALLOWED_TO_CANCEL_THIS_INVITATION",
  "MEMBER_NOT_FOUND",
  "INVITATION_NOT_FOUND",
  "YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION",
  "INVITER_IS_NO_LONGER_A_MEMBER_OF_THE_ORGANIZATION",
  "PLAN_TEAM_REQUIRED",
] as const;
type TeamErrorCode = (typeof CODES)[number];

function isTeamErrorCode(code: string | undefined): code is TeamErrorCode {
  return !!code && (CODES as readonly string[]).includes(code);
}

/** In the current request's language: call it from server actions. */
export async function teamErrorMessage(error: unknown, fallback?: string) {
  const t = await getTranslations("server.team");
  if (isAPIError(error)) {
    const code = (error.body as { code?: string } | undefined)?.code;
    if (isTeamErrorCode(code)) return t(code);
  }
  console.error("[team]", error);
  return fallback ?? t("fallback");
}
