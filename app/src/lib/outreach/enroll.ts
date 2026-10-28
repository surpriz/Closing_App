import { isSupportedLocale } from "@/lib/closing/constants";
import { prisma } from "@/lib/db";

import { type Actor, canEditCampaign } from "./campaigns";
import {
  guessColumnMapping,
  MAX_IMPORT_ROWS,
  parseCsv,
  PROSPECT_COLUMNS,
  type ProspectColumn,
  type ProspectRow,
  rowsToProspects,
} from "./csv";
import { templateVarsOf } from "./planner";
import { renderTemplate } from "./render";
import { suppressedAmong } from "./suppression";
import { detectCountryTimezone } from "./timezone";

const LIVE_ENROLLMENT = ["QUEUED", "ACTIVE", "PAUSED"] as const;

// Free mailboxes: a warning at import, never a refusal. `hotmail.*`-style entries match any suffix.
export const PERSONAL_DOMAINS: readonly string[] = [
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.*",
  "live.*",
  "yahoo.*",
  "icloud.com",
  "me.com",
  "free.fr",
  "orange.fr",
  "wanadoo.fr",
  "laposte.net",
  "sfr.fr",
  "proton.me",
  "protonmail.com",
];

function isPersonalDomain(email: string) {
  const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase();
  return PERSONAL_DOMAINS.some((entry) => (entry.endsWith(".*") ? domain.startsWith(entry.slice(0, -1)) : domain === entry));
}

export type ImportRejection = { line: number; reason: "no_email" | "invalid_email" };
export type ImportSummary = {
  mapping: Partial<Record<ProspectColumn, string>>; // column to the header it was detected on
  enrolled: number;
  suppressed: number;
  duplicates: number;
  team: number;
  elsewhere: number;
  personal: number;
  missingVariables: number; // enrolled rows lacking a variable the steps use without fallback: they will pause at send
  rejected: ImportRejection[];
  tooMany: boolean; // more rows than MAX_IMPORT_ROWS: nothing was imported
};

export type PreparedProspect = ProspectRow & {
  timezone: string;
  locale: string;
  status: "QUEUED" | "SUPPRESSED";
  pausedReason: string | null;
  flags: { team: boolean; personal: boolean };
};

/** Pure: dedupes by email within the file, drops team addresses, marks suppressed ones, resolves timezone and locale. */
export function prepareProspects(
  rows: ProspectRow[],
  ctx: { suppressed: Set<string>; teamEmails: string[]; sellerTimezone: string; campaignLocale: string },
): { prospects: PreparedProspect[]; duplicates: number; team: number; personal: number } {
  const team = new Set(ctx.teamEmails.map((email) => email.trim().toLowerCase()));
  const suppressed = new Set([...ctx.suppressed].map((email) => email.toLowerCase()));
  const seen = new Set<string>();
  const prospects: PreparedProspect[] = [];
  let duplicates = 0;
  let teamCount = 0;
  let personal = 0;

  for (const row of rows) {
    const email = row.email.trim().toLowerCase();
    if (seen.has(email)) {
      duplicates++;
      continue;
    }
    seen.add(email);
    if (team.has(email)) {
      teamCount++;
      continue;
    }
    const isPersonal = isPersonalDomain(email);
    if (isPersonal) personal++;
    const isSuppressed = suppressed.has(email);
    const locale = row.locale?.trim().toLowerCase().split(/[-_]/)[0] ?? "";
    prospects.push({
      ...row,
      email,
      timezone: detectCountryTimezone(row.timezone ?? row.country, ctx.sellerTimezone),
      locale: isSupportedLocale(locale) ? locale : ctx.campaignLocale,
      status: isSuppressed ? "SUPPRESSED" : "QUEUED",
      pausedReason: isSuppressed ? "suppressed" : null,
      flags: { team: false, personal: isPersonal },
    });
  }
  return { prospects, duplicates, team: teamCount, personal };
}

export async function importProspects(input: {
  organizationId: string;
  campaignId: string;
  csv: string;
  sellerTimezone: string;
  actor: Actor;
  now?: Date;
}): Promise<ImportSummary | { error: "campaign_not_found" | "empty" }> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: input.campaignId, organizationId: input.organizationId, status: { not: "ARCHIVED" } },
    select: { locale: true, createdById: true, steps: { select: { subject: true, body: true } } },
  });
  if (!campaign || !canEditCampaign(campaign, input.actor)) return { error: "campaign_not_found" };

  const parsed = parseCsv(input.csv);
  if (parsed.rows.length === 0) return { error: "empty" };

  const indexes = guessColumnMapping(parsed.headers);
  const mapping: ImportSummary["mapping"] = {};
  for (const column of PROSPECT_COLUMNS) {
    const index = indexes[column];
    if (index !== undefined) mapping[column] = parsed.headers[index];
  }
  const summary: ImportSummary = {
    mapping,
    enrolled: 0,
    suppressed: 0,
    duplicates: 0,
    team: 0,
    elsewhere: 0,
    personal: 0,
    missingVariables: 0,
    rejected: [],
    tooMany: false,
  };
  if (parsed.rows.length > MAX_IMPORT_ROWS) return { ...summary, tooMany: true };

  const { prospects: rows, rejected } = rowsToProspects(parsed, indexes);
  summary.rejected = rejected;

  const members = await prisma.member.findMany({
    where: { organizationId: input.organizationId },
    select: { user: { select: { email: true } } },
  });
  const teamEmails = members.map((member) => member.user.email);
  const suppressed = await suppressedAmong(input.organizationId, rows.map((row) => row.email));
  const prepared = prepareProspects(rows, {
    suppressed,
    teamEmails,
    sellerTimezone: input.sellerTimezone,
    campaignLocale: campaign.locale,
  });
  summary.team = prepared.team;
  summary.personal = prepared.personal;
  summary.duplicates = prepared.duplicates;

  // One query for both checks: already in this campaign (skipped) or live in another one (enrolled anyway, counted)
  const known = prepared.prospects.length
    ? await prisma.campaignProspect.findMany({
        where: {
          organizationId: input.organizationId,
          email: { in: prepared.prospects.map((prospect) => prospect.email) },
          OR: [{ campaignId: input.campaignId }, { status: { in: [...LIVE_ENROLLMENT] } }],
        },
        select: { email: true, campaignId: true, status: true },
      })
    : [];
  const inThisCampaign = new Set(known.filter((row) => row.campaignId === input.campaignId).map((row) => row.email));
  const elsewhere = new Set(
    known
      .filter((row) => row.campaignId !== input.campaignId && (LIVE_ENROLLMENT as readonly string[]).includes(row.status))
      .map((row) => row.email),
  );

  const fresh = prepared.prospects.filter((prospect) => !inThisCampaign.has(prospect.email));
  summary.duplicates += prepared.prospects.length - fresh.length;
  summary.elsewhere = fresh.filter((prospect) => elsewhere.has(prospect.email)).length;
  summary.suppressed = fresh.filter((prospect) => prospect.status === "SUPPRESSED").length;
  // Checked against the steps as they are now: editing them later (a fallback, say) changes the outcome
  const stepsText = campaign.steps.map((step) => `${step.subject ?? ""}\n${step.body}`).join("\n");
  summary.missingVariables = fresh.filter(
    (prospect) =>
      prospect.status === "QUEUED" &&
      renderTemplate(stepsText, templateVarsOf(prospect, null)).missing.some((name) => name.toLowerCase() !== "link"),
  ).length;

  if (fresh.length > 0) {
    const { count } = await prisma.campaignProspect.createMany({
      data: fresh.map((prospect) => ({
        campaignId: input.campaignId,
        organizationId: input.organizationId,
        email: prospect.email,
        firstName: prospect.firstName,
        lastName: prospect.lastName,
        company: prospect.company,
        title: prospect.title,
        vars: prospect.vars,
        timezone: prospect.timezone,
        locale: prospect.locale,
        status: prospect.status,
        pausedReason: prospect.pausedReason,
      })),
      skipDuplicates: true,
    });
    // a concurrent import may have won some rows: they are duplicates too
    summary.duplicates += fresh.length - count;
    summary.enrolled = Math.max(0, count - summary.suppressed);
  }
  return summary;
}

/**
 * Ends an enrollment and cancels what it still had in the outbox. False when it was already over.
 * A SENDING row belongs to its lease and is left alone: a send already under way may still go out (the sender only
 * re-checks the enrollment up to the moment it writes the Message-ID), and the sender records what really happened.
 */
export async function stopEnrollment(
  id: string,
  to: "STOPPED" | "BOUNCED" | "REPLIED" | "UNSUBSCRIBED" | "SUPPRESSED",
  reason: string | null,
  now: Date,
): Promise<boolean> {
  const [enrollment] = await prisma.$transaction([
    prisma.campaignProspect.updateMany({
      where: { id, status: { in: [...LIVE_ENROLLMENT] } },
      data: { status: to, finishedAt: now, pausedReason: reason, ...(to === "REPLIED" ? { repliedAt: now } : {}) },
    }),
    prisma.campaignMessage.updateMany({
      where: { enrollmentId: id, status: "SCHEDULED" },
      data: { status: "CANCELLED" },
    }),
  ]);
  return enrollment.count > 0;
}

/** The enrollment belongs to the workspace and to a campaign the actor may edit. */
async function editableEnrollment(organizationId: string, id: string, actor: Actor): Promise<boolean> {
  const enrollment = await prisma.campaignProspect.findFirst({
    where: { id, organizationId },
    select: { campaign: { select: { createdById: true } } },
  });
  return enrollment !== null && canEditCampaign(enrollment.campaign, actor);
}

export async function pauseEnrollment(organizationId: string, id: string, now: Date, actor: Actor): Promise<boolean> {
  if (!(await editableEnrollment(organizationId, id, actor))) return false;
  const { count } = await prisma.campaignProspect.updateMany({
    where: { id, organizationId, status: "ACTIVE" },
    data: { status: "PAUSED", pausedReason: "seller", pausedAt: now },
  });
  return count > 0;
}

/**
 * Scheduled messages stay as they are: the sender re-checks business hours before each one. A step that failed or was
 * cancelled while the enrollment was paused is re-opened, otherwise the catch-up would pause it again at once.
 */
export async function resumeEnrollment(organizationId: string, id: string, now: Date, actor: Actor): Promise<boolean> {
  if (!(await editableEnrollment(organizationId, id, actor))) return false;
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.campaignProspect.updateMany({
      where: { id, organizationId, status: "PAUSED" },
      data: { status: "ACTIVE", pausedReason: null, pausedAt: null },
    });
    if (count === 0) return false;
    const enrollment = await tx.campaignProspect.findUnique({
      where: { id },
      select: { currentStep: true, campaign: { select: { steps: { select: { id: true, order: true } } } } },
    });
    const blocked = enrollment?.campaign.steps.find((step) => step.order === enrollment.currentStep + 1);
    if (blocked) {
      await tx.campaignMessage.updateMany({
        where: { enrollmentId: id, stepId: blocked.id, status: { in: ["FAILED", "CANCELLED"] } },
        data: { status: "SCHEDULED", scheduledFor: now, attempts: 0, messageId: null, sendingAt: null, error: null },
      });
    }
    return true;
  });
}

export async function removeEnrollment(organizationId: string, id: string, now: Date, actor: Actor): Promise<boolean> {
  if (!(await editableEnrollment(organizationId, id, actor))) return false;
  return stopEnrollment(id, "STOPPED", "seller", now);
}
