/**
 * `"Display name" <address>` for a From header, the address taken from a
 * configured sender ("Clozer <noreply@x>" or a bare address). Pure.
 * The name comes from a reader: quotes, brackets and line breaks are stripped
 * so it cannot inject headers, and a non-ASCII name is encoded (RFC 2047),
 * which the email provider requires.
 */
export function senderAs(displayName: string, from: string) {
  const address = from.match(/<([^>]+)>/)?.[1] ?? from.trim();
  const name = displayName.replace(/["\\<>\r\n]/g, "").replace(/\s+/g, " ").trim();
  if (!name) return address;
  const encoded = /^[\x20-\x7e]*$/.test(name) ? `"${name}"` : `=?UTF-8?B?${Buffer.from(name, "utf8").toString("base64")}?=`;
  return `${encoded} <${address}>`;
}
