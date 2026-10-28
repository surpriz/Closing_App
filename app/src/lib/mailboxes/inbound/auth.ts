type Verdict = "pass" | "fail" | "other";

/** First verdict per mechanism, "pass" winning when a mail carries several signatures (dkim=fail then dkim=pass). */
function verdicts(header: string) {
  const found: Partial<Record<"dkim" | "spf" | "dmarc", Verdict>> = {};
  // The leading authserv-id never contains "=", and the method results are "name=result"
  for (const match of header.matchAll(/(?:^|[\s;(])(dkim|spf|dmarc)=([a-z]+)/gi)) {
    const method = match[1].toLowerCase() as "dkim" | "spf" | "dmarc";
    const result = match[2].toLowerCase();
    const verdict: Verdict = result === "pass" ? "pass" : result === "fail" ? "fail" : "other";
    if (found[method] === "pass") continue;
    if (found[method] === undefined || verdict === "pass") found[method] = verdict;
  }
  return found;
}

/**
 * What the receiving server wrote in Authentication-Results (RFC 8601) about the sender: true when DKIM or SPF
 * passed and DMARC did not fail, false when DMARC failed or both DKIM and SPF failed, null when the header is
 * absent or says nothing conclusive. Pure. Only the topmost header is meant to be passed: it is the one our own
 * server added, the ones below could come from the sender.
 */
export function parseAuthenticationResults(header: string | null | undefined): boolean | null {
  if (!header || !header.trim()) return null;
  const v = verdicts(header);
  if (v.dmarc === "fail") return false;
  if (v.dkim === "pass" || v.spf === "pass") return true;
  if (v.dkim === "fail" && v.spf === "fail") return false;
  return null;
}
