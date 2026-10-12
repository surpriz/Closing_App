import { describe, expect, it } from "vitest";

import {
  extractPageTitle,
  fallbackName,
  framingAllowed,
  htmlToText,
  knownEmbedUrl,
  parseWebUrl,
  playerSrc,
  videoProvider,
} from "./web-link";

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

describe("htmlToText", () => {
  it("keeps the readable text, one block per line", () => {
    const html = `<html><head><meta name="description" content="Offre Growth">
      <style>body{color:red}</style></head>
      <body><nav>Accueil Tarifs</nav><h1>Offre&nbsp;Growth</h1>
      <p>Audit &amp; refonte, <b>14 500 &euro;</b> HT</p><script>track()</script>
      <footer>Mentions légales</footer></body></html>`;
    expect(htmlToText(html)).toBe("Offre Growth\nAudit & refonte, 14 500 € HT");
  });

  it("adds the meta description when the body does not say it", () => {
    const html = `<meta content="Démo produit en 3 minutes" name="description"><body><div id="app"></div></body>`;
    expect(htmlToText(html)).toBe("Démo produit en 3 minutes");
  });

  it("decodes numeric entities and leaves unknown ones", () => {
    expect(htmlToText("<body><p>l&#x2019;offre &#233;t&eacute; &foo;</p></body>")).toBe("l’offre été &foo;");
  });

  it("caps the length", () => {
    expect(htmlToText(`<body><p>${"a".repeat(50)}</p></body>`, 10)).toHaveLength(10);
  });
});

describe("parsing real-world HTML", () => {
  it("keeps apostrophes in titles and descriptions", () => {
    const html = `<meta property="og:title" content="Proposition d'accompagnement"><meta content="L'offre complète" name="description">`;
    expect(extractPageTitle(html)).toBe("Proposition d'accompagnement");
    expect(htmlToText(html)).toBe("L'offre complète");
  });

  it("survives impossible entities", () => {
    expect(htmlToText("<body><p>a &#99999999999; b &#x110000;</p></body>")).toBe("a &#99999999999; b &#x110000;");
  });

  it("strips nested and unclosed hidden blocks", () => {
    expect(htmlToText("<body><nav><nav>menu</nav>more menu</nav><p>Offre</p><script>x</script><p>Prix</p></body>")).toBe(
      "Offre\nPrix",
    );
    expect(htmlToText("<body><p>Offre</p><footer>legal")).toBe("Offre");
  });

  it("stays fast on broken markup", () => {
    const broken = `<body>${"<nav><!--".repeat(20_000)}<p>fin</p></body>`;
    const started = performance.now();
    htmlToText(broken);
    expect(performance.now() - started).toBeLessThan(500);
  });
});

describe("videoProvider", () => {
  it("recognizes the players we can follow", () => {
    expect(videoProvider("https://www.youtube.com/embed/dQw4")).toBe("youtube");
    expect(videoProvider("https://player.vimeo.com/video/12345")).toBe("vimeo");
    expect(videoProvider("https://www.loom.com/embed/abc123")).toBe("loom");
  });

  it("ignores everything else", () => {
    expect(videoProvider(null)).toBeNull();
    expect(videoProvider("https://acme.notion.site/ebd/abc")).toBeNull();
    expect(videoProvider("https://www.youtube.com/watch?v=dQw4")).toBeNull();
    expect(videoProvider("not a url")).toBeNull();
  });
});

describe("playerSrc", () => {
  it("turns on the YouTube JS API", () => {
    expect(playerSrc("https://www.youtube.com/embed/dQw4")).toBe("https://www.youtube.com/embed/dQw4?enablejsapi=1");
  });

  it("leaves other players alone", () => {
    expect(playerSrc("https://player.vimeo.com/video/12345")).toBe("https://player.vimeo.com/video/12345");
    expect(playerSrc("https://acme.notion.site/ebd/abc")).toBe("https://acme.notion.site/ebd/abc");
  });
});
