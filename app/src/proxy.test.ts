import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "./proxy";

const rewriteOf = (path: string) =>
  proxy(new NextRequest(`https://app.clozer.club${path}`)).headers.get("x-middleware-rewrite");

describe("proxy", () => {
  it("reads a worded address as its slug", () => {
    expect(rewriteOf("/v/acme-devis-renovation-mHiTw7Wdh4uT")).toBe("https://app.clozer.club/v/mHiTw7Wdh4uT");
  });

  it("keeps the query", () => {
    expect(rewriteOf("/v/acme-mHiTw7Wdh4uT?r=abc")).toBe("https://app.clozer.club/v/mHiTw7Wdh4uT?r=abc");
  });

  it("leaves an older address alone", () => {
    expect(rewriteOf("/v/mHiTw7Wdh4uT")).toBeNull();
  });

  it("still gives the reader a visitor id", () => {
    const response = proxy(new NextRequest("https://app.clozer.club/v/acme-mHiTw7Wdh4uT"));
    expect(response.cookies.getAll().length).toBe(1);
  });
});
