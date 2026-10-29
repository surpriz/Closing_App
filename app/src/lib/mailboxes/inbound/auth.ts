/** Removes quoted strings and (nested) comments: free text there, such as "(dkim=pass)", is not a result. */
function stripNoise(header: string) {
  let out = "";
  let depth = 0;
  let quoted = false;
  for (let i = 0; i < header.length; i++) {
    const c = header[i];
    if (quoted) {
      if (c === "\\") i++;
      else if (c === '"') quoted = false;
    } else if (c === "\\" && depth > 0) i++;
    else if (c === "(") depth++;
    else if (c === ")" && depth > 0) depth--;
    else if (depth === 0) {
      if (c === '"') {
        quoted = true;
        // A placeholder, not a blank: a quoted local part ("a b"@host) must stay one token
        out += "q";
      } else out += c;
    }
  }
  return out;
}

type Method = "dkim" | "spf" | "dmarc";
type Entry = { method: Method; result: string; props: Record<string, string> };

/** One resinfo per ";" segment, read from the start of the segment only: a result inside a property value is text. */
function entries(header: string): Entry[] {
  const out: Entry[] = [];
  for (const segment of stripNoise(header).split(";")) {
    const head = /^\s*(dkim|spf|dmarc)\s*=\s*([a-z]+)\b([\s\S]*)$/i.exec(segment);
    if (!head) continue;
    const props: Record<string, string> = {};
    for (const prop of head[3].matchAll(/\b([a-z]+\.[a-z-]+)=(\S+)/gi)) props[prop[1].toLowerCase()] ??= prop[2];
    out.push({ method: head[1].toLowerCase() as Method, result: head[2].toLowerCase(), props });
  }
  return out;
}

/** Domain of "user@host", "@host" or "host", lowercased; after the last "@" so a quoted local part cannot fake it. */
export function domainOf(value: string | undefined) {
  if (!value) return null;
  const host = value.slice(value.lastIndexOf("@") + 1).replace(/[<>]/g, "").replace(/\.$/, "").toLowerCase();
  return host.includes(".") ? host : null;
}

/** The From domain itself or its parent ("mail.target.io" is covered by "target.io"; a bare TLD never is). */
function aligned(domain: string | null, fromDomain: string | null) {
  if (fromDomain === null) return true;
  return domain !== null && (domain === fromDomain || fromDomain.endsWith(`.${domain}`));
}

/**
 * What the receiving server wrote in Authentication-Results (RFC 8601) about the sender, judged against the From
 * domain. true: dmarc=pass, or a DKIM/SPF pass aligned with the From domain (header.d or header.i, smtp.mailfrom)
 * and no dmarc=fail. false: any dmarc=fail (final, a later pass never overrides it), or no aligned pass while DKIM or
 * SPF report fail (a lone spf=fail included). null: header absent, or nothing conclusive. A pass for another domain
 * is ignored, as a spoofer can always sign with his own. Without a From domain alignment is not checked. Pure.
 * Comments and quoted strings are stripped and only the method=result opening each ";" segment is read, so free text
 * cannot fake a result. The authserv-id is not checked: the topmost header is trusted because it is the one our own
 * receiving server prepends; headers below it travel with the mail and could be forged, and they are not read here.
 */
export function parseAuthenticationResults(header: string | null | undefined, fromDomain?: string | null): boolean | null {
  if (!header || !header.trim()) return null;
  const from = fromDomain ? fromDomain.toLowerCase() : null;
  const all = entries(header);
  if (all.some((e) => e.method === "dmarc" && e.result === "fail")) return false;
  if (all.some((e) => e.method === "dmarc" && e.result === "pass")) return true;
  const alignedPass = all.some(
    (e) =>
      e.result === "pass" &&
      ((e.method === "dkim" && aligned(domainOf(e.props["header.d"]) ?? domainOf(e.props["header.i"]), from)) ||
        (e.method === "spf" && aligned(domainOf(e.props["smtp.mailfrom"]), from))),
  );
  if (alignedPass) return true;
  if (all.some((e) => e.method !== "dmarc" && e.result === "fail")) return false;
  return null;
}
