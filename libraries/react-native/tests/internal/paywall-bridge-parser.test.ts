// The real `@voidhash/paywalls` runtime encoder — round-tripping its output
// through this parser proves the two packages agree on the wire format.
import {
  createEventEnvelope,
  serializeEnvelope,
} from "../../../paywalls/src/runtime/envelope";
import {
  PaywallBridgeParseError,
  parsePaywallBridgeEnvelope,
} from "../../src/internal/paywall-bridge/parser";
import { describe, expect, it } from "../helpers/effect-vitest";

describe("parsePaywallBridgeEnvelope", () => {
  it("parses a valid purchase payload", () => {
    const parsed = parsePaywallBridgeEnvelope(
      JSON.stringify({
        payload: {
          productId: "pro_monthly",
        },
        type: "purchase",
        version: 1,
      })
    );

    expect(parsed.type).toBe("purchase");
    if (parsed.type === "purchase") {
      expect(parsed.payload.productId).toBe("pro_monthly");
    }
  });

  it("throws for invalid version", () => {
    expect(() =>
      parsePaywallBridgeEnvelope(
        JSON.stringify({
          type: "ready",
          version: 99,
        })
      )
    ).toThrow(PaywallBridgeParseError);
  });

  it("throws for invalid payload shape", () => {
    expect(() =>
      parsePaywallBridgeEnvelope(
        JSON.stringify({
          payload: {
            productId: "",
          },
          type: "purchase",
          version: 1,
        })
      )
    ).toThrow(PaywallBridgeParseError);
  });

  it("parses a valid event payload", () => {
    const parsed = parsePaywallBridgeEnvelope(
      JSON.stringify({
        payload: {
          name: "cta_seen",
          properties: { screen: "home" },
        },
        type: "event",
        version: 1,
      })
    );

    expect(parsed.type).toBe("event");
    if (parsed.type === "event") {
      expect(parsed.payload.name).toBe("cta_seen");
      expect(parsed.payload.properties).toEqual({ screen: "home" });
    }
  });

  it("parses an event without properties", () => {
    const parsed = parsePaywallBridgeEnvelope(
      JSON.stringify({
        payload: {
          name: "bare",
        },
        type: "event",
        version: 1,
      })
    );

    expect(parsed.type).toBe("event");
    if (parsed.type === "event") {
      expect(parsed.payload.properties).toBeUndefined();
    }
  });

  it("throws for an event without a name", () => {
    expect(() =>
      parsePaywallBridgeEnvelope(
        JSON.stringify({
          payload: { properties: {} },
          type: "event",
          version: 1,
        })
      )
    ).toThrow(PaywallBridgeParseError);
  });

  it("throws for an event with non-object properties", () => {
    expect(() =>
      parsePaywallBridgeEnvelope(
        JSON.stringify({
          payload: { name: "cta_seen", properties: "nope" },
          type: "event",
          version: 1,
        })
      )
    ).toThrow(PaywallBridgeParseError);
  });

  it("round-trips the paywalls runtime's createEventEnvelope output", () => {
    const parsed = parsePaywallBridgeEnvelope(
      serializeEnvelope(createEventEnvelope("cta_seen", { screen: "home" }))
    );

    expect(parsed).toMatchObject({
      payload: { name: "cta_seen", properties: { screen: "home" } },
      type: "event",
      version: 1,
    });
  });
});
