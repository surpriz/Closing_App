import { describe, expect, it } from "vitest";

import { extractPageTitle, fallbackName, framingAllowed, knownEmbedUrl, parseWebUrl } from "./web-link";

const APP = "https://app.clozer.club";

function embed(value: string) {
  return knownEmbedUrl(parseWebUrl(value)!);
}

describe("parseWebUrl", () => {
  it("adds https to a bare domain", () => {
    expect(parseWebUrl("acme.notion.site/Offre")?.toString()).toBe("https://acme.notion.site/Offre");
  });

  it("rejects text that is not a link", () => {
    expect(parseWebUrl("devis")).toBeNull();
    expect(parseWebUrl("mon devis.pdf")).toBeNull();
    expect(parseWebUrl("javascript:alert(1)")).toBeNull();
    expect(parseWebUrl("ftp://files.acme.com/a")).toBeNull();
  });
});

describe("knownEmbedUrl", () => {
  it("maps share links to embed players", () => {
    expect(embed("https://www.loom.com/share/abc123?sid=x")).toBe("https://www.loom.com/embed/abc123");
    expect(embed("https://www.youtube.com/watch?v=dQw4")).toBe("https://www.youtube.com/embed/dQw4");
    expect(embed("https://youtu.be/dQw4")).toBe("https://www.youtube.com/embed/dQw4");
    expect(embed("https://vimeo.com/12345")).toBe("https://player.vimeo.com/video/12345");
    expect(embed("https://docs.google.com/presentation/d/XYZ/edit#slide=id.p")).toBe(
      "https://docs.google.com/presentation/d/XYZ/preview",
    );
    expect(embed("https://www.canva.com/design/DAF1/abc/view")).toBe("https://www.canva.com/design/DAF1/view?embed");
  });

  it("uses the embeddable /ebd/ page of published Notion pages", () => {
    expect(embed("https://acme.notion.site/Offre-Acme-4d6a6bebfaf44a4e9e1cc7692d5f9c2f?pvs=4")).toBe(
      "https://acme.notion.site/ebd/4d6a6bebfaf44a4e9e1cc7692d5f9c2f",
    );
    expect(embed("https://acme.notion.site/ebd/4d6a6bebfaf44a4e9e1cc7692d5f9c2f")).toBeNull();
  });

  it("wraps Figma links in the Figma embed player", () => {
    expect(embed("https://www.figma.com/design/KEY/Offre")).toBe(
      "https://www.figma.com/embed?embed_host=clozer&url=https%3A%2F%2Fwww.figma.com%2Fdesign%2FKEY%2FOffre",
    );
  });

  it("returns null for other sites", () => {
    expect(embed("https://acme.notion.site/Offre")).toBeNull();
    expect(embed("https://acme.webflow.io/")).toBeNull();
  });
});

describe("framingAllowed", () => {
  it("allows pages without framing headers", () => {
    expect(framingAllowed(new Headers(), APP)).toBe(true);
  });

  it("blocks X-Frame-Options", () => {
    expect(framingAllowed(new Headers({ "X-Frame-Options": "SAMEORIGIN" }), APP)).toBe(false);
    expect(framingAllowed(new Headers({ "X-Frame-Options": "DENY" }), APP)).toBe(false);
  });

  it("reads CSP frame-ancestors", () => {
    const csp = (value: string) => new Headers({ "Content-Security-Policy": value });
    expect(framingAllowed(csp("default-src 'self'; frame-ancestors 'self'"), APP)).toBe(false);
    expect(framingAllowed(csp("frame-ancestors 'none'"), APP)).toBe(false);
    expect(framingAllowed(csp("frame-ancestors *"), APP)).toBe(true);
    expect(framingAllowed(csp("frame-ancestors https://*.clozer.club"), APP)).toBe(true);
    expect(framingAllowed(csp("script-src 'self'"), APP)).toBe(true);
    expect(framingAllowed(csp("frame-ancestors https: http:"), APP)).toBe(true);
    expect(framingAllowed(csp("frame-ancestors http:"), APP)).toBe(false);
  });
});

describe("extractPageTitle", () => {
  it("prefers og:title and decodes entities", () => {
    const html = `<title>Notion</title><meta property="og:title" content="Offre Acme &amp; Co" />`;
    expect(extractPageTitle(html)).toBe("Offre Acme & Co");
  });

  it("falls back to the title tag", () => {
    expect(extractPageTitle("<html><title>\n  Proposition 2026 </title>")).toBe("Proposition 2026");
    expect(extractPageTitle("<html></html>")).toBeNull();
  });
});

describe("fallbackName", () => {
  it("keeps host and path", () => {
    expect(fallbackName(new URL("https://www.acme.com/offre/"))).toBe("acme.com/offre");
  });

  it("turns a Notion slug into words", () => {
    expect(fallbackName(new URL("https://acme.notion.site/Offre-Acme-2026-ed4565006f194a2fbe7d3a4965d7b15a"))).toBe(
      "Offre Acme 2026",
    );
    expect(fallbackName(new URL("https://acme.com/proposition-commerciale"))).toBe("proposition commerciale");
  });
});
