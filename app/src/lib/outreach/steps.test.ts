import { describe, expect, it } from "vitest";

import { linkStep, type StepInput, unknownVariables, unknownVariablesWithoutFallback, validateSteps } from "./steps";

const step = (over: Partial<StepInput> = {}): StepInput => ({
  order: 1,
  delayDays: 0,
  subject: "Hello",
  newThread: false,
  body: "Hi {{firstName|there}}",
  carriesLink: false,
  ...over,
});
const follow = (order: number, over: Partial<StepInput> = {}) =>
  step({ order, delayDays: 3, subject: null, body: "Following up", ...over });

describe("validateSteps", () => {
  it("accepts a clean sequence", () => {
    expect(validateSteps([step(), follow(2)])).toEqual([]);
  });

  it("refuses an empty sequence", () => {
    expect(validateSteps([])).toEqual([{ code: "no_steps" }]);
  });

  it("wants orders 1..n without gaps", () => {
    expect(validateSteps([step(), follow(3)])).toEqual([{ code: "order", order: 3 }]);
  });

  it("caps the number of steps", () => {
    const many = [step(), ...[2, 3, 4, 5, 6, 7, 8, 9].map((order) => follow(order))];
    expect(validateSteps(many)).toContainEqual({ code: "order", order: 9 });
  });

  it("wants a subject on step 1 and on a new thread", () => {
    expect(validateSteps([step({ subject: " " })])).toEqual([{ code: "subject_required", order: 1 }]);
    expect(validateSteps([step(), follow(2, { newThread: true })])).toEqual([{ code: "subject_required", order: 2 }]);
    expect(validateSteps([step(), follow(2, { newThread: true, subject: "Other angle" })])).toEqual([]);
  });

  it("checks delays", () => {
    expect(validateSteps([step({ delayDays: 1 })])).toEqual([{ code: "delay", order: 1 }]);
    expect(validateSteps([step(), follow(2, { delayDays: 0 })])).toEqual([{ code: "delay", order: 2 }]);
    expect(validateSteps([step(), follow(2, { delayDays: 61 })])).toEqual([{ code: "delay", order: 2 }]);
  });

  it("refuses empty and oversized text", () => {
    expect(validateSteps([step({ body: "  " })])).toEqual([{ code: "empty_body", order: 1 }]);
    expect(validateSteps([step({ body: "x".repeat(5001) })])).toEqual([{ code: "too_long", order: 1 }]);
    expect(validateSteps([step({ subject: "x".repeat(201) })])).toEqual([{ code: "too_long", order: 1 }]);
  });

  it("keeps {{link}} in the step that carries it", () => {
    expect(validateSteps([step({ body: "See {{link}}" })])).toEqual([{ code: "link_outside_link_step", order: 1 }]);
    expect(validateSteps([step({ body: "See {{ Link }}", carriesLink: true })])).toEqual([]);
    expect(validateSteps([step({ subject: "{{link}}" })])).toEqual([{ code: "link_outside_link_step", order: 1 }]);
  });

  it("allows one link step only", () => {
    const issues = validateSteps([step({ carriesLink: true, body: "{{link}}" }), follow(2, { carriesLink: true, body: "{{link}}" })]);
    expect(issues).toEqual([{ code: "several_link_steps" }]);
  });
});

describe("unknownVariables", () => {
  it("knows the built-ins whatever the case", () => {
    expect(unknownVariables([step({ body: "{{FirstName}} {{company}} {{LINK}}" })])).toEqual([]);
  });

  it("lists the others once, in order, unless a CSV column provides them", () => {
    const steps = [step({ subject: "{{offer}}", body: "{{Role}} {{offer}} {{role}}" })];
    expect(unknownVariables(steps)).toEqual(["offer", "Role"]);
    expect(unknownVariables(steps, ["role"])).toEqual(["offer"]);
  });
});

describe("unknownVariablesWithoutFallback", () => {
  it("ignores a variable that always has a fallback, keeps one used bare at least once", () => {
    const steps = [step({ subject: "{{offer|our offer}}", body: "{{city|}} {{offer}} {{team|you}}" })];
    expect(unknownVariablesWithoutFallback(steps)).toEqual(["city", "offer"]);
    expect(unknownVariablesWithoutFallback(steps, ["Offer"])).toEqual(["city"]);
  });
});

describe("linkStep", () => {
  it("returns the order of the link step, or null", () => {
    expect(linkStep([{ order: 1, carriesLink: false }, { order: 2, carriesLink: true }])).toBe(2);
    expect(linkStep([{ order: 1, carriesLink: false }])).toBeNull();
  });
});
