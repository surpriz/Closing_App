/**
 * Test helpers (time travel, engine run) for local dev and staging. Same code
 * everywhere; turned on by ENABLE_TEST_TOOLS=true and never in production,
 * whatever the variable says.
 */
export function testToolsEnabled() {
  if (process.env.VERCEL_ENV === "production") return false;
  return process.env.NODE_ENV === "development" || process.env.ENABLE_TEST_TOOLS === "true";
}
