import { describe, expect, it } from "vitest";

import { contactEmailFromConversation, escalationDedupeKey, promisesSellerReply } from "./escalation";

describe("escalationDedupeKey", () => {
  it("ignores case, accents and punctuation", () => {
    expect(escalationDedupeKey("v1", "Une remise est-elle possible ?")).toBe(escalationDedupeKey("v1", "une remise est elle POSSIBLE"));
  });

  it("differs per session and per question", () => {
    expect(escalationDedupeKey("v1", "Remise ?")).not.toBe(escalationDedupeKey("v2", "Remise ?"));
    expect(escalationDedupeKey("v1", "Remise ?")).not.toBe(escalationDedupeKey("v1", "Délai ?"));
  });
});

describe("contactEmailFromConversation", () => {
  it("keeps an email the reader typed", () => {
    expect(contactEmailFromConversation("Anne@Acme.fr", ["Écrivez-moi à anne@acme.fr"])).toBe("anne@acme.fr");
  });

  it("drops an email the reader never typed", () => {
    expect(contactEmailFromConversation("anne@acme.fr", ["Une remise ?"])).toBeNull();
  });

  it("drops what is not an email", () => {
    expect(contactEmailFromConversation("anne", ["anne"])).toBeNull();
    expect(contactEmailFromConversation(undefined, [])).toBeNull();
  });
});

describe("promisesSellerReply", () => {
  it("spots a promised answer in the four languages", () => {
    expect(promisesSellerReply("Jérôme reviendra vers vous rapidement.")).toBe(true);
    expect(promisesSellerReply("Jérôme will get back to you.")).toBe(true);
    expect(promisesSellerReply("Jérôme se pondrá en contacto con usted.")).toBe(true);
    expect(promisesSellerReply("Jérôme meldet sich bei Ihnen.")).toBe(true);
  });

  it("ignores a plain answer", () => {
    expect(promisesSellerReply("Le paiement se fait à 30 jours.")).toBe(false);
  });
});
