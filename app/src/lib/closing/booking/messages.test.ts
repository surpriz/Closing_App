import { describe, expect, it } from "vitest";

import { parseBookingMessage } from "./messages";

const CALENDLY = "https://calendly.com";
const CAL = "https://app.cal.com";

const cal = (type: string, data: unknown = {}, namespace = "clozer") => ({
  originator: "CAL",
  type,
  namespace,
  fullType: `CAL:${namespace}:${type}`,
  data,
});

describe("parseBookingMessage — Calendly", () => {
  it("recognises a scheduled event", () => {
    const data = { event: "calendly.event_scheduled", payload: { event: { uri: "x" }, invitee: { uri: "y" } } };
    expect(parseBookingMessage({ origin: CALENDLY, data }, "calendly")).toEqual({ kind: "booked", startTime: null });
  });

  it("ignores other steps of the flow", () => {
    expect(parseBookingMessage({ origin: CALENDLY, data: { event: "calendly.date_and_time_selected" } }, "calendly")).toBeNull();
    expect(parseBookingMessage({ origin: CALENDLY, data: { event: "calendly.event_type_viewed" } }, "calendly")).toEqual({
      kind: "loaded",
    });
  });

  it("refuses the same message from another origin", () => {
    const data = { event: "calendly.event_scheduled" };
    expect(parseBookingMessage({ origin: "https://evil.example", data }, "calendly")).toBeNull();
    expect(parseBookingMessage({ origin: "http://calendly.com", data }, "calendly")).toBeNull();
    expect(parseBookingMessage({ origin: CAL, data }, "calendly")).toBeNull();
  });
});

describe("parseBookingMessage — Cal.com", () => {
  it("recognises a booking and keeps its start time", () => {
    const message = { origin: CAL, data: cal("bookingSuccessfulV2", { uid: "u", startTime: "2026-10-20T09:00:00Z" }) };
    expect(parseBookingMessage(message, "calcom")).toEqual({ kind: "booked", startTime: "2026-10-20T09:00:00.000Z" });
  });

  it("accepts the deprecated event and a missing or broken date", () => {
    expect(parseBookingMessage({ origin: "https://cal.com", data: cal("bookingSuccessful") }, "calcom")).toEqual({
      kind: "booked",
      startTime: null,
    });
    expect(parseBookingMessage({ origin: CAL, data: cal("bookingSuccessfulV2", { startTime: "soon" }) }, "calcom")).toEqual({
      kind: "booked",
      startTime: null,
    });
  });

  it("ignores dry runs, other namespaces and foreign senders", () => {
    expect(parseBookingMessage({ origin: CAL, data: cal("dryRunBookingSuccessfulV2") }, "calcom")).toBeNull();
    expect(parseBookingMessage({ origin: CAL, data: cal("bookingSuccessfulV2", {}, "other") }, "calcom")).toBeNull();
    expect(parseBookingMessage({ origin: CAL, data: { ...cal("bookingSuccessfulV2"), originator: "X" } }, "calcom")).toBeNull();
    expect(parseBookingMessage({ origin: "https://cal.acme.com", data: cal("bookingSuccessfulV2") }, "calcom")).toBeNull();
    expect(parseBookingMessage({ origin: CAL, data: "bookingSuccessfulV2" }, "calcom")).toBeNull();
  });

  it("reports the handshake, load and size of the frame", () => {
    expect(parseBookingMessage({ origin: CAL, data: cal("__iframeReady", { isPrerendering: false }) }, "calcom")).toEqual({
      kind: "cal_handshake",
    });
    expect(parseBookingMessage({ origin: CAL, data: cal("linkReady") }, "calcom")).toEqual({ kind: "loaded" });
    expect(parseBookingMessage({ origin: CAL, data: cal("linkFailed", { code: "404" }) }, "calcom")).toEqual({ kind: "failed" });
    expect(parseBookingMessage({ origin: CAL, data: cal("__dimensionChanged", { iframeHeight: 812.4 }) }, "calcom")).toEqual({
      kind: "resize",
      height: 812,
    });
  });

  it("never trusts messages for an external tool", () => {
    expect(parseBookingMessage({ origin: CAL, data: cal("bookingSuccessfulV2") }, "external")).toBeNull();
  });
});
