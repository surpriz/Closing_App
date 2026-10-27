import { describe, expect, it } from "vitest";

import { renderTemplate, templateVariables, threadSubject } from "./render";

describe("renderTemplate", () => {
  it("fills simple variables", () => {
    expect(renderTemplate("Hi {{firstName}} at {{company}}", { firstName: "Ana", company: "Acme" })).toEqual({
      text: "Hi Ana at Acme",
      missing: [],
    });
  });

  it("uses the fallback when the value is empty or absent", () => {
    expect(renderTemplate("Hello {{firstName|there}}", { firstName: "  " }).text).toBe("Hello there");
    expect(renderTemplate("Hello {{firstName| my friend }}", {}).text).toBe("Hello my friend");
  });

  it("prefers the value over the fallback", () => {
    expect(renderTemplate("Hello {{firstName|there}}", { firstName: "Ana" }).text).toBe("Hello Ana");
  });

  it("matches keys case-insensitively and allows spaces", () => {
    expect(renderTemplate("{{ FIRSTNAME }} / {{ company | x }}", { firstName: "Ana", Company: "Acme" }).text).toBe("Ana / Acme");
  });

  it("reports missing variables once and renders them empty", () => {
    const out = renderTemplate("{{a}} {{b}} {{a}} {{c|ok}}", { b: null });
    expect(out.text).toBe("   ok");
    expect(out.missing).toEqual(["a", "b"]);
  });

  it("dedups missing names case-insensitively", () => {
    expect(renderTemplate("{{Foo}} {{foo}}", {}).missing).toEqual(["Foo"]);
  });

  it("leaves {{link}} as is when absent, fills it when given", () => {
    expect(renderTemplate("See {{link}}", {})).toEqual({ text: "See {{link}}", missing: [] });
    expect(renderTemplate("See {{ Link }}", { link: "https://x.y" }).text).toBe("See https://x.y");
  });
});

describe("templateVariables", () => {
  it("lists distinct names in order without fallbacks", () => {
    expect(templateVariables("{{b|x}} {{a}} {{ B }} {{c}}")).toEqual(["b", "a", "c"]);
  });
});

describe("threadSubject", () => {
  const step = (o: Partial<{ order: number; subject: string | null; newThread: boolean }> = {}) => ({
    order: 2,
    subject: null,
    newThread: false,
    ...o,
  });

  it("starts a new thread on step 1", () => {
    expect(threadSubject(step({ order: 1 }), "Hello", "Rendered")).toEqual({ subject: "Rendered", sameThread: false });
  });

  it("starts a new thread when asked or when there is no thread subject", () => {
    expect(threadSubject(step({ newThread: true }), "Hello", "R")).toEqual({ subject: "R", sameThread: false });
    expect(threadSubject(step(), null, null)).toEqual({ subject: "", sameThread: false });
  });

  it("replies in the thread with Re:", () => {
    expect(threadSubject(step(), "Hello", null)).toEqual({ subject: "Re: Hello", sameThread: true });
  });

  it("does not double Re: or Fwd:", () => {
    expect(threadSubject(step(), "Re: Hello", null).subject).toBe("Re: Hello");
    expect(threadSubject(step(), "RE: Hello", null).subject).toBe("RE: Hello");
    expect(threadSubject(step(), "Fwd: Hello", null).subject).toBe("Fwd: Hello");
  });
});
