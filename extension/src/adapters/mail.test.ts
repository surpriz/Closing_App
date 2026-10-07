import { beforeEach, describe, expect, it } from "vitest";

import { composeRoot, findAttachmentRemover, firstRecipient, insertionAnchor, press, sameFileName } from "./mail";

// Simplified from Gmail and Outlook web compose markup. The real markup must be
// checked by hand after any breakage: see extension/README.md.
const GMAIL = `
<div role="dialog" id="root">
  <div class="to">
    <div role="option" data-hovercard-id="marie@acme-group.fr" data-name="Marie Dupont">Marie Dupont</div>
    <div role="option" data-hovercard-id="paul@acme-group.fr" data-name="Paul">Paul</div>
  </div>
  <div id="body" contenteditable="true" role="textbox">
    <div>Bonjour Marie,</div>
    <div><br></div>
    <div class="gmail_signature_prefix">-- </div>
    <div class="gmail_signature"><div>Jérôme</div></div>
  </div>
  <div class="attachments">
    <div class="chip"><div class="name">devis.pdf</div><div role="button" aria-label="Supprimer la pièce jointe"></div></div>
  </div>
</div>`;

const OUTLOOK = `
<div data-app-section="ComposeForm" id="root">
  <div aria-label="À">
    <span><button aria-label="Marie Dupont marie@acme.fr">Marie Dupont</button></span>
  </div>
  <div class="att"><div><span title="Proposition.pdf">Proposition.pdf</span><button aria-label="More actions"></button><button aria-label="Remove attachment"></button></div></div>
  <div id="body" contenteditable="true" role="textbox">
    <div>Hello</div>
    <div id="Signature"><div>Best</div></div>
    <div id="divRplyFwdMsg">From: ...</div>
  </div>
</div>`;

function mount(html: string) {
  document.body.innerHTML = html;
  return {
    root: document.getElementById("root")!,
    body: document.getElementById("body")!,
  };
}

describe("gmail adapter", () => {
  beforeEach(() => mount(GMAIL));

  it("finds the compose and its first recipient", () => {
    const body = document.getElementById("body")!;
    const root = composeRoot("gmail", body);
    expect(root.id).toBe("root");
    expect(firstRecipient("gmail", root, body)).toEqual({ email: "marie@acme-group.fr", displayName: "Marie Dupont" });
  });

  it("inserts above the signature", () => {
    const body = document.getElementById("body")!;
    expect(insertionAnchor("gmail", body)?.className).toBe("gmail_signature");
  });

  it("finds the attachment remove button", () => {
    const { root, body } = mount(GMAIL);
    expect(findAttachmentRemover(root, body, "devis.pdf")?.getAttribute("aria-label")).toBe("Supprimer la pièce jointe");
    expect(findAttachmentRemover(root, body, "autre.pdf")).toBeNull();
  });
});

describe("outlook adapter", () => {
  it("reads the recipient from the persona label", () => {
    const { body } = mount(OUTLOOK);
    const root = composeRoot("outlook", body);
    expect(root.id).toBe("root");
    expect(firstRecipient("outlook", root, body)).toEqual({ email: "marie@acme.fr", displayName: "Marie Dupont" });
  });

  it("inserts above the signature and the quoted message", () => {
    const { body } = mount(OUTLOOK);
    expect(insertionAnchor("outlook", body)?.id).toBe("Signature");
  });

  it("picks the remove button, not the menu", () => {
    const { root, body } = mount(OUTLOOK);
    expect(findAttachmentRemover(root, body, "Proposition.pdf")?.getAttribute("aria-label")).toBe("Remove attachment");
  });

  it("ignores addresses typed in the body", () => {
    document.body.innerHTML = `<div data-app-section="ComposeForm" id="root"><div id="body" contenteditable="true"><a title="x@y.fr">x@y.fr</a></div></div>`;
    const body = document.getElementById("body")!;
    expect(firstRecipient("outlook", document.getElementById("root")!, body)).toBeNull();
  });
});

describe("sameFileName", () => {
  it("matches names the mail app shortened", () => {
    expect(sameFileName("devis.pdf", "Devis.pdf")).toBe(true);
    expect(sameFileName("devis", "devis.pdf")).toBe(true);
    expect(sameFileName("Proposition comm…2026.pdf", "Proposition commerciale 2026.pdf")).toBe(true);
    expect(sameFileName("Proposition...2026.pdf", "Proposition commerciale 2026.pdf")).toBe(true);
  });

  it("does not match other files", () => {
    expect(sameFileName("autre.pdf", "devis.pdf")).toBe(false);
    expect(sameFileName("…pdf", "devis.pdf")).toBe(false);
    expect(sameFileName("", "devis.pdf")).toBe(false);
  });
});

describe("thread safety", () => {
  it("does not take a recipient from another message of the thread", () => {
    document.body.innerHTML = `
      <div><div data-hovercard-id="ancien@thread.fr">Ancien</div>
        <div id="reply"><div id="body" contenteditable="true" role="textbox"></div></div>
        <div><div contenteditable="true" role="textbox"></div></div>
      </div>`;
    const body = document.getElementById("body")!;
    const root = composeRoot("gmail", body);
    expect(firstRecipient("gmail", root, body)).toBeNull();
  });

  it("ignores chips after the body", () => {
    document.body.innerHTML = `<div role="dialog" id="root"><div id="body" contenteditable="true" role="textbox"></div><div data-hovercard-id="after@x.fr"></div></div>`;
    const body = document.getElementById("body")!;
    expect(firstRecipient("gmail", document.getElementById("root")!, body)).toBeNull();
  });
});

describe("attachment removal", () => {
  const CHIPS = `
    <div role="dialog" id="root">
      <div id="body" contenteditable="true" role="textbox"></div>
      <div class="attachments">
        <div class="dL"><a class="dO"><div class="vI">autre.pdf</div><div class="vJ">(12 Ko)</div></a><div role="button" class="vq" id="x-other"></div></div>
        <div class="dL"><a class="dO"><div class="vI">2026-09-AD.pdf</div><div class="vJ">(39 Ko)</div></a><div role="button" class="vq" id="x-mine"></div></div>
      </div>
    </div>`;

  it("finds an unlabelled remove control next to the right chip", () => {
    const { root, body } = mount(CHIPS);
    expect(findAttachmentRemover(root, body, "2026-09-AD.pdf")?.id).toBe("x-mine");
    expect(findAttachmentRemover(root, body, "autre.pdf")?.id).toBe("x-other");
  });

  it("recognises a lone × glyph", () => {
    const { root, body } = mount(`<div role="dialog" id="root"><div id="body" contenteditable="true" role="textbox"></div>
      <div><span>devis.pdf</span><button id="x">×</button></div></div>`);
    expect(findAttachmentRemover(root, body, "devis.pdf")?.id).toBe("x");
  });

  it("looks outside the compose when the chips are rendered elsewhere", () => {
    document.body.innerHTML = `<div role="dialog" id="root"><div id="body" contenteditable="true" role="textbox"></div></div>
      <div><span>devis.pdf</span><div role="button" aria-label="Supprimer la pièce jointe" id="x"></div></div>`;
    const root = document.getElementById("root")!;
    const body = document.getElementById("body")!;
    expect(findAttachmentRemover(root, body, "devis.pdf")?.id).toBe("x");
  });

  it("press() reaches buttons that only listen to mousedown", () => {
    const { root, body } = mount(CHIPS);
    const remover = findAttachmentRemover(root, body, "2026-09-AD.pdf")!;
    remover.addEventListener("mousedown", () => remover.closest(".dL")!.remove());
    press(remover);
    expect(findAttachmentRemover(root, body, "2026-09-AD.pdf")).toBeNull();
  });
});
