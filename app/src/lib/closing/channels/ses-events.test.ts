import { describe, expect, it } from "vitest";

import { bounceDetail, sesEventSchema } from "./ses-events";

describe("SES events", () => {
  it("reads event publishing and the older notifications alike", () => {
    const published = sesEventSchema.parse({ eventType: "Delivery", mail: { messageId: "a" }, delivery: {} });
    const legacy = sesEventSchema.parse({ notificationType: "Delivery", mail: { messageId: "a" }, delivery: {} });
    expect(published.kind).toBe("Delivery");
    expect(legacy.kind).toBe("Delivery");
  });

  it("keeps one readable line of the bounce", () => {
    const event = sesEventSchema.parse({
      eventType: "Bounce",
      mail: { messageId: "a" },
      bounce: {
        bounceType: "Permanent",
        bounceSubType: "General",
        bouncedRecipients: [{ emailAddress: "x@y.z", diagnosticCode: "smtp; 550 5.1.1   user\n unknown" }],
      },
    });
    expect(bounceDetail(event)).toBe("smtp; 550 5.1.1 user unknown");
  });

  it("falls back on the bounce type without a diagnostic", () => {
    const event = sesEventSchema.parse({
      eventType: "Bounce",
      mail: { messageId: "a" },
      bounce: { bounceType: "Permanent", bounceSubType: "NoEmail", bouncedRecipients: [{ emailAddress: "x@y.z" }] },
    });
    expect(bounceDetail(event)).toBe("Permanent / NoEmail");
  });
});
