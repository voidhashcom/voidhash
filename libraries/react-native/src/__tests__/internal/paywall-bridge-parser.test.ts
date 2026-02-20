import {
  PaywallBridgeParseError,
  parsePaywallBridgeEnvelope,
} from "../../internal/paywall-bridge/parser";

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
});
