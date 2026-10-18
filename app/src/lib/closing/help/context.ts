import type { UiLocale } from "@/i18n/locale";
import { prisma } from "@/lib/db";
import { isManagerRole, isOwnerRole } from "@/lib/roles";

/**
 * What the help assistant knows about the user asking: where they are and how
 * far they got. Counts and switches only, never a prospect or a sale: the
 * assistant explains Clozer, it does not read the pipeline.
 */

export type HelpUserState = {
  firstName: string | null;
  role: string;
  workspaceName: string;
  onboardingDone: boolean;
  mailClient: string | null;
  documents: number;
  activeLinks: number;
  mailToolConnected: boolean;
  autopilot: boolean;
};

/** Longest prefix wins, so /documents/abc is a document page and not the list. UI names as the user sees them. */
const PAGE_LABELS_EN: [prefix: string, label: string][] = [
  ["/dashboard", "Today (daily cockpit)"],
  ["/documents/", "a document page (links per prospect, what Clozer understood, what blocks)"],
  ["/documents", "Documents (list and upload)"],
  ["/links/", "a prospect page (one prospect's link: follow-ups, readers, activity)"],
  ["/team", "Team (team view, managers only)"],
  ["/settings", "Settings"],
  ["/how-it-works", "How it works"],
  ["/faq", "Frequently asked questions (FAQ)"],
];

const PAGE_LABELS_FR: [prefix: string, label: string][] = [
  ["/dashboard", "Aujourd'hui (daily cockpit)"],
  ["/documents/", "a document page (links per prospect, what Clozer understood, what blocks)"],
  ["/documents", "Documents (list and upload)"],
  ["/links/", "a prospect page (one prospect's link: follow-ups, readers, activity)"],
  ["/team", "Équipe (team view, managers only)"],
  ["/settings", "Réglages"],
  ["/how-it-works", "Comment ça marche"],
  ["/faq", "Questions fréquentes (FAQ)"],
];

export function pageLabel(pathname: string | null | undefined, locale: UiLocale = "fr") {
  if (!pathname) return null;
  const match = (locale === "en" ? PAGE_LABELS_EN : PAGE_LABELS_FR).filter(([prefix]) => pathname === prefix || pathname.startsWith(prefix)).sort(
    (a, b) => b[0].length - a[0].length,
  )[0];
  return match?.[1] ?? null;
}

function roleLabel(role: string) {
  if (isOwnerRole(role)) return "owner (manages the workspace and the team)";
  if (isManagerRole(role)) return "admin (manages the team)";
  return "member (seller, sees and changes their own prospects)";
}

/** Pure: the <user_state> block given to the model. */
export function formatHelpContext(state: HelpUserState, pathname: string | null | undefined, locale: UiLocale) {
  const yesNo = (value: boolean) => (value ? "yes" : "no");
  const lines = [
    `first name: ${state.firstName ?? "unknown"}`,
    `workspace: ${state.workspaceName}`,
    `role: ${roleLabel(state.role)}`,
    `welcome tour finished: ${yesNo(state.onboardingDone)}`,
    `mailbox: ${state.mailClient ?? "not said"}`,
    `Chrome extension or Outlook add-in connected: ${yesNo(state.mailToolConnected)}`,
    `documents: ${state.documents}`,
    `active links: ${state.activeLinks}`,
    `follow-up mode: ${state.autopilot ? "autopilot" : "copilot (every follow-up waits for approval)"}`,
  ];
  const page = pageLabel(pathname, locale);
  return `<user_state>\n${lines.join("\n")}\n</user_state>\n<current_page>${page ?? "unknown"}</current_page>`;
}

export async function loadHelpContext(input: {
  organizationId: string;
  organizationName: string;
  userId: string;
  userName: string | null;
  role: string;
}): Promise<HelpUserState> {
  const { organizationId, userId } = input;
  const [preference, documents, activeLinks, tokens, settings] = await Promise.all([
    prisma.notificationPreference.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: { onboardingCompletedAt: true, mailClient: true },
    }),
    prisma.document.count({ where: { organizationId, archivedAt: null } }),
    prisma.link.count({ where: { organizationId, createdById: userId, archivedAt: null, draftAt: null } }),
    prisma.extensionToken.count({ where: { organizationId, userId, revokedAt: null } }),
    prisma.workspaceSettings.findUnique({ where: { organizationId }, select: { autonomy: true } }),
  ]);
  return {
    firstName: input.userName?.trim().split(/\s+/)[0] || null,
    role: input.role,
    workspaceName: input.organizationName,
    onboardingDone: !!preference?.onboardingCompletedAt,
    mailClient: preference?.mailClient ?? null,
    documents,
    activeLinks,
    mailToolConnected: tokens > 0,
    autopilot: settings?.autonomy === "AUTOPILOT",
  };
}
