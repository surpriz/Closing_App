import { describe, expect, it } from "vitest";

import { buildDigest, digestSubject, isDigestDue, sinceLabel, type DigestData } from "./digest-content";

const empty: DigestData = {
  appUrl: "https://app.clozer.club",
  sinceLabel: "hier",
  todo: [],
  actions: [],
  counts: { readers: 0, followupsSent: 0, followupsFailed: 0, unsubscribed: 0 },
  autoSent: [],
  drafts: 0,
};
const todo = (label: string) => ({ label, documentName: "Devis", why: "Relit les tarifs", url: `https://app.clozer.club/links/${label}` });

describe("buildDigest", () => {
  it("sends nothing when there is nothing to do", () => {
    expect(buildDigest({ ...empty, counts: { readers: 3, followupsSent: 1, followupsFailed: 0, unsubscribed: 0 } })).toBeNull();
  });

  it("leads with who to contact today, capped at five", () => {
    const digest = buildDigest({ ...empty, todo: ["A", "B", "C", "D", "E", "F"].map(todo) })!;
    expect(digest.subject).toBe("Ce matin : 5 prospects à recontacter");
    expect(digest.text).toContain("À FAIRE AUJOURD'HUI");
    expect(digest.text).toContain("Relit les tarifs");
    expect(digest.text).not.toContain("- F ·");
  });

  it("quotes the prospect's change request and escapes it in HTML", () => {
    const digest = buildDigest({
      ...empty,
      actions: [{ label: "Acme", kind: "change", message: "Remise <10%> ?", url: "https://x/l" }],
    })!;
    expect(digest.subject).toBe("1 réponse de prospects depuis hier");
    expect(digest.text).toContain("Acme demande un ajustement");
    expect(digest.html).toContain("Remise &lt;10%&gt; ?");
  });

  it("lists the questions passed on by the assistant with the answers", () => {
    const digest = buildDigest({
      ...empty,
      actions: [{ label: "Acme", kind: "question", message: "Une remise est-elle possible ?", url: "https://x/l#questions" }],
    })!;
    expect(digest.text).toContain("Acme a posé une question");
    expect(digest.text).toContain("« Une remise est-elle possible ? »");
  });

  it("lists extension requests with the answers", () => {
    const digest = buildDigest({
      ...empty,
      actions: [{ label: "Acme", kind: "extension", message: null, url: "https://x/l" }],
    })!;
    expect(digest.text).toContain("Acme demande une prolongation");
  });

  it("warns about links about to lock", () => {
    const digest = buildDigest({
      ...empty,
      expiring: [{ label: "Acme", documentName: "Devis", when: "jeudi 15 octobre à 23:59", url: "https://x/l#expiration" }],
    })!;
    expect(digest.subject).toBe("1 lien expire bientôt");
    expect(digest.text).toContain("EXPIRENT BIENTÔT");
    expect(digest.text).toContain("Se verrouille le jeudi 15 octobre à 23:59");
  });

  it("lists the counts of the period and the drafts waiting", () => {
    const digest = buildDigest({
      ...empty,
      sinceLabel: "vendredi",
      drafts: 2,
      counts: { readers: 4, followupsSent: 1, followupsFailed: 0, unsubscribed: 1 },
    })!;
    expect(digest.subject).toBe("2 relances attendent votre accord");
    expect(digest.text).toContain("DEPUIS VENDREDI");
    expect(digest.text).toContain("4 prospects ont lu votre proposition, 1 relance partie, 1 désinscription.");
  });

  it("names autopilot sends in the subject when that is all there is", () => {
    expect(digestSubject({ ...empty, autoSent: [{ label: "Acme", subject: "Suite", url: "u" }] })).toBe(
      "Clozer a relancé 1 prospect pour vous",
    );
  });
});

describe("isDigestDue", () => {
  const prefs = { morningDigest: true, digestHour: 8, timezone: "Europe/Paris" };
  // Thursday 8 Oct 2026
  const at = (utcHour: number) => new Date(Date.UTC(2026, 9, 8, utcHour, 5));

  it("goes out once the hour is reached, once a day", () => {
    expect(isDigestDue(prefs, null, at(5))).toBe(false); // 7:05 Paris
    expect(isDigestDue(prefs, null, at(6))).toBe(true); // 8:05 Paris
    expect(isDigestDue(prefs, at(6), at(7))).toBe(false);
    expect(isDigestDue(prefs, new Date(Date.UTC(2026, 9, 7, 6)), at(6))).toBe(true);
  });

  it("skips weekends, late afternoons and sellers who turned it off", () => {
    expect(isDigestDue(prefs, null, new Date(Date.UTC(2026, 9, 10, 7)))).toBe(false);
    expect(isDigestDue(prefs, null, at(14))).toBe(false);
    expect(isDigestDue({ ...prefs, morningDigest: false }, null, at(6))).toBe(false);
  });
});

describe("sinceLabel", () => {
  it("says hier after one day and the weekday after a weekend", () => {
    const monday = new Date(Date.UTC(2026, 9, 12, 6));
    expect(sinceLabel(new Date(Date.UTC(2026, 9, 11, 6)), monday, "Europe/Paris")).toBe("hier");
    expect(sinceLabel(new Date(Date.UTC(2026, 9, 9, 6)), monday, "Europe/Paris")).toBe("vendredi");
  });
});
