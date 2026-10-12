import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

// Loopback, private, link-local, CGNAT, multicast, reserved. BlockList also
// checks IPv4-mapped IPv6 (::ffff:127.0.0.1) against the IPv4 rules.
const PRIVATE = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  PRIVATE.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  PRIVATE.addSubnet(network, prefix, "ipv6");
}

export function isPrivateAddress(address: string) {
  const family = isIP(address);
  if (family === 0) return true;
  return PRIVATE.check(address, family === 4 ? "ipv4" : "ipv6");
}

/**
 * Whether every address a hostname resolves to is public. The hostname check
 * alone lets through a public name pointing at an internal service.
 */
export async function resolvesToPublicAddress(hostname: string) {
  if (process.env.NODE_ENV !== "production") return true;
  try {
    const addresses = await lookup(hostname.replace(/^\[|\]$/g, ""), { all: true, verbatim: true });
    return addresses.length > 0 && addresses.every(({ address }) => !isPrivateAddress(address));
  } catch {
    return false;
  }
}
