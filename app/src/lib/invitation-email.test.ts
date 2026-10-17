import { describe, expect, it } from "vitest";

import { buildInvitationEmail } from "./invitation-email";

describe("buildInvitationEmail", () => {
  const email = buildInvitationEmail({
    inviterName: "Léa <Martin>",
    workspaceName: "Acme",
    url: "https://app.test/invitation/abc",
    locale: "fr",
  });

  it("names the inviter in the subject", () => {
    expect(email.subject).toBe("Léa <Martin> vous invite sur Clozer");
  });

  it("links to the invitation page and escapes names", () => {
    expect(email.html).toContain('href="https://app.test/invitation/abc"');
    expect(email.html).toContain("Léa &lt;Martin&gt;");
    expect(email.text).toContain("Rejoindre l'équipe : https://app.test/invitation/abc");
  });

  it("writes in the inviter's language", () => {
    const en = buildInvitationEmail({ inviterName: "Lea", workspaceName: "Acme", url: "https://app.test/i", locale: "en" });
    expect(en.subject).toBe("Lea invited you to Clozer");
    expect(en.text).toContain("Join the team: https://app.test/i");
  });
});
