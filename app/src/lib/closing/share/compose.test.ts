import { describe, expect, it } from "vitest";

import { composeUrl, firstNameOf, guessMailClient, mailClientLabel, parseShareRecipient, shareDraft } from "./compose";

const draft = shareDraft({ url: "https://clozer.app/v/abc", title: "Devis Acme", to: "marie@acme.com", firstName: "Marie" });

describe("shareDraft", () => {
  it("writes a short message with the link", () => {
    expect(draft.subject).toBe("Devis Acme");
    expect(draft.body).toBe("Bonjour Marie,\n\nVoici Devis Acme :\nhttps://clozer.app/v/abc");
  });

  it("adds the signature when there is one", () => {
    expect(shareDraft({ url: "u", title: "t", signature: "Paul\nAcme" }).body).toBe("Bonjour,\n\nVoici t :\nu\n\nPaul\nAcme");
  });

  it("writes in the seller's language", () => {
    expect(shareDraft({ url: "u", title: "the quote", firstName: "Mary", locale: "en" }).body).toBe("Hi Mary,\n\nHere is the quote:\nu");
  });
});

describe("composeUrl", () => {
  it("opens Gmail's compose window", () => {
    const url = composeUrl("gmail", draft)!;
    expect(url.startsWith("https://mail.google.com/mail/?view=cm&fs=1&to=marie%40acme.com&su=Devis%20Acme")).toBe(true);
  });

  it("opens Outlook on the web", () => {
    expect(composeUrl("outlook_web", draft)).toContain("outlook.office.com/mail/deeplink/compose?to=marie%40acme.com");
  });

  it("falls back to mailto, without a recipient if unknown", () => {
    expect(composeUrl(null, { ...draft, to: "" })).toMatch(/^mailto:\?subject=Devis%20Acme/);
  });
});

describe("firstNameOf", () => {
  it("keeps the first word of a name", () => {
    expect(firstNameOf("Marie Martin")).toBe("Marie");
    expect(firstNameOf("marie@acme.com")).toBeNull();
    expect(firstNameOf(null)).toBeNull();
  });
});

describe("parseShareRecipient", () => {
  it("reads an address alone or with a name", () => {
    expect(parseShareRecipient(" Marie@Acme.com ")).toEqual({ email: "marie@acme.com", label: null });
    expect(parseShareRecipient('"Marie Martin" <marie@acme.com>')).toEqual({ email: "marie@acme.com", label: "Marie Martin" });
    expect(parseShareRecipient("Marie Martin, marie@acme.com")).toEqual({ email: "marie@acme.com", label: "Marie Martin" });
  });

  it("keeps a plain name as the link label", () => {
    expect(parseShareRecipient("Acme SAS")).toEqual({ email: null, label: "Acme SAS" });
    expect(parseShareRecipient("   ")).toEqual({ email: null, label: null });
  });
});

describe("guessMailClient", () => {
  it("knows the big webmails only", () => {
    expect(guessMailClient("paul@gmail.com")).toBe("gmail");
    expect(guessMailClient("paul@hotmail.fr")).toBe("outlook_web");
    expect(guessMailClient("paul@acme.com")).toBeNull();
  });
});

describe("mailClientLabel", () => {
  it("names Gmail and Outlook as the seller knows them", () => {
    expect(mailClientLabel("gmail")).toBe("Gmail");
    expect(mailClientLabel("outlook_web")).toBe("Outlook");
    expect(mailClientLabel("outlook_desktop")).toBe("Outlook");
  });

  it("has no name for an unknown or missing client", () => {
    expect(mailClientLabel("apple_mail")).toBeNull();
    expect(mailClientLabel(null)).toBeNull();
  });
});
