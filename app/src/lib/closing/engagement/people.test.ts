import { describe, expect, it } from "vitest";

import { countPeople } from "./people";

describe("countPeople", () => {
  it("counts one address once, across browsers and before the gate", () => {
    expect(
      countPeople([
        { visitorId: "phone", email: "abel@photoroom.com" },
        { visitorId: "laptop", email: "Abel@Photoroom.com" },
        { visitorId: "laptop", email: null },
      ]),
    ).toBe(1);
  });

  it("counts anonymous browsers apart", () => {
    expect(
      countPeople([
        { visitorId: "a", email: null },
        { visitorId: "b", email: null },
      ]),
    ).toBe(2);
  });
});
