import { logger, schedules } from "@trigger.dev/sdk";

// Calls the app instead of touching the database directly, so this task has
// no Prisma or env duplication. Needs APP_URL and CRON_SECRET in the
// Trigger.dev environment variables.
export const closingTick = schedules.task({
  id: "closing-tick",
  cron: "*/5 * * * *",
  maxDuration: 180,
  run: async () => {
    const appUrl = process.env.APP_URL;
    const secret = process.env.CRON_SECRET;
    if (!appUrl || !secret) {
      throw new Error("APP_URL and CRON_SECRET must be set in the Trigger.dev environment");
    }

    const response = await fetch(`${appUrl.replace(/\/$/, "")}/api/cron/closing`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!response.ok) {
      throw new Error(`Closing tick failed with status ${response.status}`);
    }

    const result = await response.json();
    logger.info("closing tick done", result);
    return result;
  },
});
