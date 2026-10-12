// How many reveals a workspace may still start today. Pure.
// Protects the provider credits (2500 a month on Apollo) from a click spree.

export function revealAllowance(input: { revealsToday: number; requested: number; dailyLimit: number }) {
  const left = Math.max(0, input.dailyLimit - input.revealsToday);
  return Math.min(input.requested, left);
}
