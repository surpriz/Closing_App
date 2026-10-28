// Checks the cold-email engine's queries against a real Postgres. Never run in CI, never against production:
// it creates rows (one organization and its mailbox, campaigns, enrollments, messages) and deletes them in a `finally`.
//
//   OUTREACH_IT_CONFIRM=yes DATABASE_URL=<disposable Neon branch, migrated> node scripts/outreach-integration.mjs
//
// The TypeScript modules cannot be imported from a plain .mjs (the app is not compiled to a path), so the script
// re-issues the same queries in SQL, copied from src/lib/outreach/campaigns.ts (finishIdleCampaigns), sender.ts
// (candidate query of sendDueMessages) and src/lib/mailboxes/caps/counter.ts (reserveSend). Keep them in sync.
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url || process.env.OUTREACH_IT_CONFIRM !== "yes") {
  console.error("Set DATABASE_URL to a disposable branch and OUTREACH_IT_CONFIRM=yes: this script writes to the database.");
  process.exit(1);
}
const sql = neon(url);
console.log(`database host: ${new URL(url).host}`);

const tag = `it${Date.now().toString(36)}`;
const id = (name) => `${tag}_${name}`;
const ids = { user: id("user"), org: id("org"), mailbox: id("mb"), campaignA: id("campA"), campaignB: id("campB") };
const now = new Date();
const past = new Date(now.getTime() - 3600_000);
const future = new Date(now.getTime() + 3600_000);
const failures = [];

function check(label, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : ` ${detail}`}`);
  if (!ok) failures.push(label);
}

async function seed() {
  await sql`INSERT INTO users (id, name, email, "updatedAt") VALUES (${ids.user}, 'IT', ${`${tag}@example.test`}, ${now})`;
  await sql`INSERT INTO organizations (id, name, slug, "createdAt") VALUES (${ids.org}, 'IT', ${tag}, ${now})`;
  await sql`INSERT INTO mailboxes (id, "organizationId", "userId", provider, connector, email, domain, credentials, status, timezone, "updatedAt")
    VALUES (${ids.mailbox}, ${ids.org}, ${ids.user}, 'IMAP', 'SMTP', ${`seller@${tag}.test`}, ${`${tag}.test`}, 'x', 'ACTIVE', 'Europe/Paris', ${now})`;
  for (const [campaign, enrollment, status] of [
    [ids.campaignA, id("enA"), "REPLIED"],
    [ids.campaignB, id("enB"), "ACTIVE"],
  ]) {
    await sql`INSERT INTO campaigns (id, "organizationId", "createdById", "mailboxId", name, status, locale, "updatedAt")
      VALUES (${campaign}, ${ids.org}, ${ids.user}, ${ids.mailbox}, ${campaign}, 'ACTIVE', 'en', ${now})`;
    await sql`INSERT INTO campaign_steps (id, "campaignId", "order", subject, body, "updatedAt")
      VALUES (${`${campaign}_s1`}, ${campaign}, 1, 'Hello', 'Hi', ${now})`;
    await sql`INSERT INTO campaign_prospects (id, "campaignId", "organizationId", email, timezone, locale, status, "updatedAt")
      VALUES (${enrollment}, ${campaign}, ${ids.org}, ${`${enrollment}@target.test`}, 'Europe/Paris', 'en', ${status}, ${now})`;
    // Due step, then a follow-up mirror and a step not due yet: only the first is a sender candidate
    await sql`INSERT INTO campaign_messages (id, "campaignId", "enrollmentId", "mailboxId", "stepId", kind, status, "scheduledFor", subject, body, "dedupeKey", "updatedAt")
      VALUES (${`${enrollment}_m1`}, ${campaign}, ${enrollment}, ${ids.mailbox}, ${`${campaign}_s1`}, 'STEP', 'SCHEDULED', ${past}, 'Hello', 'Hi', ${`${enrollment}:m1`}, ${now}),
             (${`${enrollment}_fu`}, ${campaign}, ${enrollment}, ${ids.mailbox}, NULL, 'FOLLOWUP', 'SCHEDULED', ${past}, 'Re: Hello', 'Hi', ${`${enrollment}:fu`}, ${now}),
             (${`${enrollment}_later`}, ${campaign}, ${enrollment}, ${ids.mailbox}, ${`${campaign}_s1`}, 'STEP', 'SCHEDULED', ${future}, 'Hello', 'Hi', ${`${enrollment}:later`}, ${now})`;
  }
}

// sendDueMessages: kind STEP, SCHEDULED and due, campaign ACTIVE, enrollment ACTIVE
async function candidates() {
  const rows = await sql`SELECT m.id FROM campaign_messages m
    JOIN campaigns c ON c.id = m."campaignId" JOIN campaign_prospects e ON e.id = m."enrollmentId"
    WHERE m."mailboxId" = ${ids.mailbox} AND m.kind = 'STEP' AND m.status = 'SCHEDULED' AND m."scheduledFor" <= ${now}
      AND c.status = 'ACTIVE' AND e.status = 'ACTIVE'
    ORDER BY m."scheduledFor" ASC`;
  return rows.map((r) => r.id);
}

// finishIdleCampaigns, scoped to our organization: some enrollment, none live
async function finishIdle() {
  const rows = await sql`UPDATE campaigns SET status = 'DONE', "finishedAt" = ${now}
    WHERE status = 'ACTIVE' AND "organizationId" = ${ids.org}
      AND EXISTS (SELECT 1 FROM campaign_prospects e WHERE e."campaignId" = campaigns.id)
      AND NOT EXISTS (SELECT 1 FROM campaign_prospects e WHERE e."campaignId" = campaigns.id AND e.status IN ('QUEUED', 'ACTIVE', 'PAUSED'))
    RETURNING id`;
  return rows.map((r) => r.id);
}

// reserveSend, verbatim
async function reserveSend(mailboxId, localDay, allowance) {
  if (allowance <= 0) return false;
  const rows = await sql`
    UPDATE mailboxes SET "sentCount" = CASE WHEN "sentDay" = ${localDay} THEN "sentCount" + 1 ELSE 1 END, "sentDay" = ${localDay}
    WHERE id = ${mailboxId} AND ("sentDay" IS DISTINCT FROM ${localDay} OR "sentCount" < ${allowance}) RETURNING "sentCount"`;
  return rows.length > 0;
}

try {
  await seed();

  const due = await candidates();
  check("sender candidates: only the due STEP of the ACTIVE enrollment", due.length === 1 && due[0] === `${id("enB")}_m1`, JSON.stringify(due));

  const finished = await finishIdle();
  check("finishIdleCampaigns flips only the campaign with no live enrollment", finished.length === 1 && finished[0] === ids.campaignA, JSON.stringify(finished));
  const statuses = await sql`SELECT id, status FROM campaigns WHERE "organizationId" = ${ids.org}`;
  const byId = Object.fromEntries(statuses.map((r) => [r.id, r.status]));
  check("the campaign with a live enrollment stays ACTIVE", byId[ids.campaignB] === "ACTIVE" && byId[ids.campaignA] === "DONE", JSON.stringify(byId));
  check("a second run flips nothing", (await finishIdle()).length === 0);

  const allowance = 5;
  const results = await Promise.all(Array.from({ length: 20 }, () => reserveSend(ids.mailbox, "2026-01-01", allowance)));
  const granted = results.filter(Boolean).length;
  const [{ sentCount }] = await sql`SELECT "sentCount" FROM mailboxes WHERE id = ${ids.mailbox}`;
  check(`reserveSend grants exactly ${allowance} of 20 concurrent calls`, granted === allowance && sentCount === allowance, `granted ${granted}, sentCount ${sentCount}`);
  check("reserveSend restarts the count on a new local day", (await reserveSend(ids.mailbox, "2026-01-02", allowance)) === true);
} catch (error) {
  console.error(error);
  failures.push("script error");
} finally {
  // Cascades remove the mailbox, campaigns, steps, enrollments and messages
  await sql`DELETE FROM organizations WHERE id = ${ids.org}`.catch((e) => console.error("cleanup org", e));
  await sql`DELETE FROM users WHERE id = ${ids.user}`.catch((e) => console.error("cleanup user", e));
}

if (failures.length > 0) {
  console.error(`${failures.length} failure(s)`);
  process.exit(1);
}
console.log("all good");
