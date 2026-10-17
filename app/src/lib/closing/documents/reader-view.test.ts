import { describe, expect, it } from "vitest";

import { cleanArticleHtml, extractReaderHtml } from "./reader-view";

const BASE = new URL("https://news.example.com/2026/10/article");
const PARAGRAPH =
  "Le principal du collège a été blessé ce matin, a indiqué la préfecture, qui précise que les secours sont intervenus rapidement sur place.";

function page(body: string, head = "") {
  return `<!doctype html><html><head><title>Titre</title>${head}</head><body>
    <nav><a href="/">Accueil</a><a href="/sport">Sport</a></nav>
    <article><h1>Titre</h1>${body}${`<p>${PARAGRAPH}</p>`.repeat(6)}</article>
    <footer>© Example</footer>
  </body></html>`;
}

describe("extractReaderHtml", () => {
  it("keeps the article and drops the page around it", () => {
    const html = extractReaderHtml(page("<h2>Les faits</h2>"), BASE)!;
    expect(html).toContain(`<p>${PARAGRAPH}</p>`);
    expect(html).toContain("<h2>Les faits</h2>");
    expect(html).not.toContain("Accueil");
    expect(html).not.toContain("©");
  });

  it("lets no script, handler or style through", () => {
    const html = extractReaderHtml(
      page(`<p onclick="steal()" style="color:red" class="lead">Intro <script>alert(1)</script><b>forte</b>
        <a href="javascript:alert(1)">piège</a> <img src="x" onerror="alert(1)"></p>
        <iframe src="https://evil.example"></iframe><svg><script>alert(2)</script></svg>`),
      BASE,
    )!;
    expect(html).not.toMatch(/script|onclick|onerror|style=|class=|javascript:|iframe|svg/i);
    expect(html).toContain("<strong>forte</strong>");
    expect(html).toContain("piège");
  });

  it("escapes text that looks like markup", () => {
    const html = extractReaderHtml(page("<p>Un tarif &lt;script&gt; à 3 &amp; 4 €</p>"), BASE)!;
    expect(html).toContain("&lt;script&gt; à 3 &amp; 4 €");
  });

  it("resolves links and images against the page, https images only", () => {
    const html = extractReaderHtml(
      page(`<p><a href="/offre">l'offre</a></p><figure><img src="/photo.jpg" alt="Photo"></figure>
        <figure><img src="http://insecure.example/old.jpg"></figure>`),
      BASE,
    )!;
    expect(html).toContain(
      `<a href="https://news.example.com/offre" target="_blank" rel="noopener noreferrer nofollow">l'offre</a>`,
    );
    expect(html).toContain(`<img src="https://news.example.com/photo.jpg" alt="Photo"`);
    expect(html).not.toContain("insecure.example");
  });

  it("puts the page's photo on top when the article has none", () => {
    const html = extractReaderHtml(page("", `<meta property="og:image" content="https://cdn.example.com/une.jpg">`), BASE)!;
    expect(html.startsWith(`<figure><img src="https://cdn.example.com/une.jpg"`)).toBe(true);
  });

  it("finds nothing to read on an app or a short page", () => {
    expect(extractReaderHtml("<html><body><div id='root'></div><script>boot()</script></body></html>", BASE)).toBeNull();
    expect(extractReaderHtml("<html><body><p>Bienvenue</p></body></html>", BASE)).toBeNull();
    expect(extractReaderHtml("", BASE)).toBeNull();
  });
});

describe("cleanArticleHtml", () => {
  // A translated article comes back from a model: it gets the same cleaning as the original
  it("drops what a model could have slipped in", () => {
    const html =
      '<p onclick="steal()">Bonjour <a href="javascript:steal()">ici</a></p><script>steal()</script><img src="http://x.test/a.png" onerror="steal()"><iframe src="https://evil.test"></iframe>';
    expect(cleanArticleHtml(html, BASE)).toBe("<p>Bonjour ici</p>");
  });

  it("keeps the article as it was", () => {
    const html = '<h2>Titre</h2><p>Un <a href="https://example.com/" target="_blank" rel="noopener noreferrer nofollow">lien</a></p>';
    expect(cleanArticleHtml(html, BASE)).toBe(html);
  });
});
