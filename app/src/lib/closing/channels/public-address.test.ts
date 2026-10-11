import { describe, expect, it } from "vitest";

import { isPrivateAddress } from "./public-address";

describe("isPrivateAddress", () => {
  it("lets public addresses through", () => {
    expect(isPrivateAddress("93.184.216.34")).toBe(false);
    expect(isPrivateAddress("2606:4700::6810:85e5")).toBe(false);
  });

  it("blocks internal ranges", () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0"]) {
      expect(isPrivateAddress(address)).toBe(true);
    }
  });

  it("blocks IPv6 loopback, local and mapped IPv4", () => {
    for (const address of ["::1", "fd00:ec2::254", "fe80::1", "::ffff:7f00:1", "::ffff:127.0.0.1"]) {
      expect(isPrivateAddress(address)).toBe(true);
    }
  });

  it("blocks what is not an address", () => {
    expect(isPrivateAddress("internal.local")).toBe(true);
  });
});
