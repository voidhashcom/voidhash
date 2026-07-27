/**
 * Interop round-trip: the configure envelope the SDK posts to the WebView must
 * parse in the REAL `@voidhash/paywalls` runtime parser (the code running
 * inside the paywall bundle). Mirrors the paywalls package's envelope test,
 * which round-trips its outbound envelopes through this package's parser.
 */
import { parseInboundEnvelope } from "../../../paywalls/src/runtime/envelope";
import {
  createPaywallBridgeConfigureMessage,
  type PaywallRuntimeConfig,
} from "../../src/internal/paywall-bridge/protocol";
import { describe, expect, it } from "../helpers/effect-vitest";

describe("paywall bridge configure interop", () => {
  it("round-trips a configure message through the paywalls runtime parser", () => {
    const config: PaywallRuntimeConfig = {
      products: [
        {
          id: "store_yearly",
          slug: "yearly",
          displayName: "Yearly Pro",
          description: "Best value",
          price: 59.99,
          priceString: "$59.99",
          currencyCode: "USD",
          period: "year",
        },
      ],
      variables: { accentColor: "#16a34a", trialDays: 7, showBadge: true },
      locale: "en-US",
      platform: "ios",
      defaultSelectedProductId: "store_yearly",
    };

    const parsed = parseInboundEnvelope(createPaywallBridgeConfigureMessage(config, "req_ready"));

    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe("configure");
    if (parsed?.type !== "configure") {
      return;
    }
    expect(parsed.requestId).toBe("req_ready");
    expect(parsed.payload.products).toEqual(config.products);
    expect(parsed.payload.variables).toEqual(config.variables);
    expect(parsed.payload.locale).toBe("en-US");
    expect(parsed.payload.platform).toBe("ios");
    expect(parsed.payload.defaultSelectedProductId).toBe("store_yearly");
  });

  it("round-trips an empty-products configure message", () => {
    const config: PaywallRuntimeConfig = {
      products: [],
      variables: {},
    };

    const parsed = parseInboundEnvelope(createPaywallBridgeConfigureMessage(config));

    expect(parsed?.type).toBe("configure");
    if (parsed?.type !== "configure") {
      return;
    }
    expect(parsed.payload.products).toEqual([]);
    expect(parsed.payload.variables).toEqual({});
  });

  it("survives the native base64/atob delivery path with non-ASCII content", () => {
    // The native presenters base64-encode the UTF-8 JSON (Swift
    // `Data(data.utf8).base64EncodedString()`, Kotlin `Base64.encodeToString`)
    // and the page decodes with `atob`, which yields one LATIN-1 character per
    // byte. Simulate that lossy leg: utf8 → base64 → latin1.
    const throughNativeDelivery = (message: string): string =>
      Buffer.from(Buffer.from(message, "utf8").toString("base64"), "base64").toString("latin1");

    const config: PaywallRuntimeConfig = {
      products: [
        {
          id: "store_yearly_fr",
          slug: "yearly",
          displayName: "Année Pro",
          description: "Meilleure offre — 7 jours d'essai",
          priceString: "59,99 €",
          currencyCode: "EUR",
          period: "year",
        },
      ],
      variables: { headline: "Débloquez tout 😀", trialDays: 7 },
      locale: "fr-FR",
      platform: "ios",
    };

    const parsed = parseInboundEnvelope(
      throughNativeDelivery(createPaywallBridgeConfigureMessage(config)),
    );

    expect(parsed?.type).toBe("configure");
    if (parsed?.type !== "configure") {
      return;
    }
    expect(parsed.payload.products[0]?.priceString).toBe("59,99 €");
    expect(parsed.payload.products[0]?.displayName).toBe("Année Pro");
    expect(parsed.payload.products[0]?.description).toBe("Meilleure offre — 7 jours d'essai");
    expect(parsed.payload.variables.headline).toBe("Débloquez tout 😀");
  });
});
