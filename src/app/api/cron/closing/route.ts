import { timingSafeEqual } from "node:crypto";

import { runClosingTick } from "@/lib/closing/engine";

export const maxDuration = 120;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runClosingTick();
  return Response.json(result);
}

// GET for Vercel Cron, POST for Trigger.dev or any other scheduler
export const GET = handle;
export const POST = handle;
