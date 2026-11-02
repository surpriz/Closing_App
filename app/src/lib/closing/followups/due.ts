/**
 * A draft approved after its suggested slot goes out at the next tick (review.ts moves
 * `scheduledFor` to now): the button and the toast must say so instead of a past date.
 */
export function followupDueNow(scheduledFor: Date, now: Date): boolean {
  return scheduledFor.getTime() <= now.getTime();
}
