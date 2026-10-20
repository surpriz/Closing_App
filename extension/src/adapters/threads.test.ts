import { describe, expect, it } from "vitest";

import { findThreadReplies } from "./threads";

const APP = "https://app.clozer.club";

function message(id: string, sender: string, body: string) {
  return `<div data-legacy-message-id="${id}"><h3><span class="gD" email="${sender}" name="${sender.split("@")[0]}">x</span></h3><div>${body}</div></div>`;
}

function thread(...messages: string[]) {
  const root = document.createElement("div");
  root.innerHTML = messages.join("");
  return root;
}

describe("thread replies", () => {
  it("reports messages from others after the one carrying the link", () => {
    const root = thread(
      message("1", "seller@acme.fr", `<a href="${APP}/v/abc123def456">Proposition</a>`),
      message("2", "marie@client.fr", "Merci, je regarde"),
    );
    expect(findThreadReplies(root, APP)).toEqual([
      { slug: "abc123def456", fromEmail: "marie@client.fr", fromName: "marie", messageKey: "2" },
    ]);
  });

  it("ignores messages before the link and the seller's own follow-ups", () => {
    const root = thread(
      message("0", "marie@client.fr", "Pouvez-vous m'envoyer une proposition ?"),
      message("1", "seller@acme.fr", `<a href="${APP}/v/abc123def456">Proposition</a>`),
      message("2", "seller@acme.fr", "Je me permets de revenir vers vous"),
    );
    expect(findThreadReplies(root, APP)).toEqual([]);
  });

  it("only knows links of the app", () => {
    const root = thread(
      message("1", "seller@acme.fr", `<a href="https://evil.example.com/v/abc123def456">x</a>`),
      message("2", "marie@client.fr", "ok"),
    );
    expect(findThreadReplies(root, APP)).toEqual([]);
  });

  it("does not count a nested id twice", () => {
    const root = thread(
      `<div data-legacy-message-id="1"><div data-message-id="#msg-1"></div><h3><span class="gD" email="seller@acme.fr">s</span></h3><a href="${APP}/v/abc123def456">p</a></div>`,
      message("2", "marie@client.fr", "ok"),
    );
    expect(findThreadReplies(root, APP)).toHaveLength(1);
  });
});
