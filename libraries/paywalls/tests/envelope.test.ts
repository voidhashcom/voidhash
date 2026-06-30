import { describe, expect, it } from "vitest";

// The normative protocol implementation lives in @voidhash/react-native; the
// round-trip below proves the envelopes this runtime emits parse cleanly with
// the exact validator the device SDK runs.
import { parsePaywallBridgeEnvelope } from "../../react-native/src/internal/paywall-bridge/parser";
import {
  createCloseEnvelope,
  createEventEnvelope,
  createOpenExternalEnvelope,
  createPurchaseEnvelope,
  createReadyEnvelope,
  createRestoreEnvelope,
  parseInboundEnvelope,
  serializeEnvelope,
} from "../src/index";

describe("outbound envelopes (protocol.ts round-trip)", () => {
  it("ready parses with the native SDK validator", () => {
    const parsed = parsePaywallBridgeEnvelope(serializeEnvelope(createReadyEnvelope()));
    expect(parsed).toMatchObject({ version: 1, type: "ready" });
  });

  it("purchase carries productId and the requestId", () => {
    const parsed = parsePaywallBridgeEnvelope(
      serializeEnvelope(createPurchaseEnvelope("com.app.yearly", "req-1")),
    );
    expect(parsed).toMatchObject({
      version: 1,
      type: "purchase",
      requestId: "req-1",
      payload: { productId: "com.app.yearly" },
    });
  });

  it("restore parses with an optional requestId", () => {
    const parsed = parsePaywallBridgeEnvelope(serializeEnvelope(createRestoreEnvelope("req-2")));
    expect(parsed).toMatchObject({
      version: 1,
      type: "restore",
      requestId: "req-2",
    });
  });

  it("close parses with and without a reason", () => {
    expect(parsePaywallBridgeEnvelope(serializeEnvelope(createCloseEnvelope()))).toMatchObject({
      version: 1,
      type: "close",
    });
    expect(
      parsePaywallBridgeEnvelope(serializeEnvelope(createCloseEnvelope("user-dismissed"))),
    ).toMatchObject({
      version: 1,
      type: "close",
      payload: { reason: "user-dismissed" },
    });
  });

  it("openExternal carries the url", () => {
    const parsed = parsePaywallBridgeEnvelope(
      serializeEnvelope(createOpenExternalEnvelope("https://voidhash.com/terms")),
    );
    expect(parsed).toMatchObject({
      version: 1,
      type: "openExternal",
      payload: { url: "https://voidhash.com/terms" },
    });
  });

  it("event matches the contract §7.2 shape and parses with the native SDK validator", () => {
    expect(
      JSON.parse(serializeEnvelope(createEventEnvelope("cta_seen", { screen: "home" }))),
    ).toEqual({
      version: 1,
      type: "event",
      payload: { name: "cta_seen", properties: { screen: "home" } },
    });
    expect(JSON.parse(serializeEnvelope(createEventEnvelope("bare")))).toEqual({
      version: 1,
      type: "event",
      payload: { name: "bare" },
    });

    expect(
      parsePaywallBridgeEnvelope(
        serializeEnvelope(createEventEnvelope("cta_seen", { screen: "home" })),
      ),
    ).toMatchObject({
      version: 1,
      type: "event",
      payload: { name: "cta_seen", properties: { screen: "home" } },
    });
    expect(
      parsePaywallBridgeEnvelope(serializeEnvelope(createEventEnvelope("bare"))),
    ).toMatchObject({ version: 1, type: "event", payload: { name: "bare" } });
  });
});

describe("parseInboundEnvelope", () => {
  it("decodes the native SDK's success response wire shape", () => {
    const raw = JSON.stringify({
      version: 1,
      type: "response",
      requestId: "req-1",
      payload: {
        action: "purchase",
        status: "success",
        data: { productId: "com.app.yearly" },
      },
    });
    expect(parseInboundEnvelope(raw)).toEqual({
      version: 1,
      type: "response",
      requestId: "req-1",
      payload: {
        action: "purchase",
        status: "success",
        data: { productId: "com.app.yearly" },
        error: undefined,
      },
    });
  });

  it("decodes error responses with code and message", () => {
    const parsed = parseInboundEnvelope(
      JSON.stringify({
        version: 1,
        type: "response",
        payload: {
          action: "restore",
          status: "error",
          error: { code: "ACTION_FAILED", message: "boom" },
        },
      }),
    );
    expect(parsed).toMatchObject({
      type: "response",
      payload: {
        action: "restore",
        status: "error",
        error: { code: "ACTION_FAILED", message: "boom" },
      },
    });
  });

  it("decodes status pushes", () => {
    expect(
      parseInboundEnvelope(
        JSON.stringify({
          version: 1,
          type: "status",
          payload: { status: "purchasing", productId: "p1" },
        }),
      ),
    ).toMatchObject({
      type: "status",
      payload: { status: "purchasing", productId: "p1" },
    });
  });

  it("decodes configure payloads into a normalized runtime config", () => {
    const parsed = parseInboundEnvelope(
      JSON.stringify({
        version: 1,
        type: "configure",
        payload: {
          products: [
            {
              id: "com.app.yearly",
              slug: "yearly",
              displayName: "Yearly",
              priceString: "$59.99",
            },
          ],
          variables: { accentColor: "#16a34a" },
          platform: "ios",
        },
      }),
    );
    expect(parsed).toEqual({
      version: 1,
      type: "configure",
      requestId: undefined,
      payload: {
        products: [
          {
            id: "com.app.yearly",
            slug: "yearly",
            displayName: "Yearly",
            priceString: "$59.99",
          },
        ],
        variables: { accentColor: "#16a34a" },
        locale: undefined,
        platform: "ios",
        defaultSelectedProductId: undefined,
      },
    });
  });

  it("fills missing configure fields with empty defaults", () => {
    const parsed = parseInboundEnvelope({
      version: 1,
      type: "configure",
      payload: {},
    });
    expect(parsed).toMatchObject({
      type: "configure",
      payload: { products: [], variables: {} },
    });
  });

  it("ignores malformed input, unknown versions and unknown actions", () => {
    expect(parseInboundEnvelope("not json")).toBeNull();
    expect(parseInboundEnvelope(JSON.stringify({ version: 2, type: "status" }))).toBeNull();
    expect(parseInboundEnvelope(JSON.stringify({ version: 1, type: "mystery" }))).toBeNull();
    expect(
      parseInboundEnvelope(
        JSON.stringify({
          version: 1,
          type: "status",
          payload: { status: "??" },
        }),
      ),
    ).toBeNull();
  });
});
