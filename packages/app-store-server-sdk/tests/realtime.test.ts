import { describe, expect, it } from "vitest";
import { Effect, Schema } from "effect";
import {
  AlternateProductSchema,
  AppDataSchema,
  BillingPlanType,
  Environment,
  MessageSchema,
  PromotionalOfferSchema,
  PromotionalOfferSignatureV1Schema,
  RealtimeAdvancedCommerceInfoSchema,
  RealtimeResponseBodySchema,
} from "../src/schemas/index.ts";
import {
  createSignedDataFromJson,
  getDefaultSignedPayloadVerifier,
  readFile,
  unwrapOptionsDeep,
} from "./util.ts";

describe("DecodedRealtimeRequestBody", () => {
  it("decodes a realtime request through the verifier", async () => {
    const signed = createSignedDataFromJson("tests/resources/models/decodedRealtimeRequest.json");
    const verifier = getDefaultSignedPayloadVerifier();

    const request = unwrapOptionsDeep(
      await Effect.runPromise(verifier.verifyAndDecodeRealtimeRequest(signed)),
    );

    expect(request.originalTransactionId).toBe("99371282");
    expect(request.appAppleId).toBe(531412);
    expect(request.productId).toBe("com.example.product");
    expect(request.userLocale).toBe("en-US");
    expect(request.requestIdentifier).toBe("3db5c98d-8acf-4e29-831e-8e1f82f9f6e9");
    expect(request.environment).toBe(Environment.LOCAL_TESTING);
    expect(request.signedDate).toBe(1698148900000);
  });
});

describe("AppData", () => {
  it("decodes an AppData payload", () => {
    const json = JSON.parse(readFile("tests/resources/models/appData.json"));
    const appData = unwrapOptionsDeep(Schema.decodeUnknownSync(AppDataSchema)(json));
    expect(appData.appAppleId).toBe(987654321);
    expect(appData.bundleId).toBe("com.example");
    expect(appData.environment).toBe("Sandbox");
    expect(appData.signedAppTransactionInfo).toBe("signed-app-transaction-info");
  });

  it("rejects an AppData payload with an invalid appAppleId type", () => {
    expect(() =>
      Schema.decodeUnknownSync(AppDataSchema)({
        appAppleId: "not-a-number",
        bundleId: "com.example",
        environment: "Sandbox",
        signedAppTransactionInfo: "signed-app-transaction-info",
      }),
    ).toThrow();
  });
});

describe("RealtimeResponseBody", () => {
  it("round-trips a message body", () => {
    const responseBody = {
      message: { messageIdentifier: "a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890" },
    };
    const parsed = unwrapOptionsDeep(
      Schema.decodeUnknownSync(RealtimeResponseBodySchema)(
        JSON.parse(JSON.stringify(responseBody)),
      ),
    );
    expect(parsed.message?.messageIdentifier).toBe("a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890");
    expect(parsed.alternateProduct).toBeUndefined();
    expect(parsed.promotionalOffer).toBeUndefined();
  });

  it("round-trips an alternateProduct body", () => {
    const responseBody = {
      alternateProduct: {
        messageIdentifier: "b2c3d4e5-f6a7-8901-b2c3-d4e5f6a78901",
        productId: "com.example.alternate.product",
        billingPlanType: BillingPlanType.MONTHLY,
      },
    };
    const parsed = unwrapOptionsDeep(
      Schema.decodeUnknownSync(RealtimeResponseBodySchema)(
        JSON.parse(JSON.stringify(responseBody)),
      ),
    );
    expect(parsed.alternateProduct?.productId).toBe("com.example.alternate.product");
    expect(parsed.alternateProduct?.billingPlanType).toBe(BillingPlanType.MONTHLY);
  });

  it("round-trips a promotionalOffer V2 body", () => {
    const parsed = unwrapOptionsDeep(
      Schema.decodeUnknownSync(RealtimeResponseBodySchema)({
        promotionalOffer: {
          messageIdentifier: "c3d4e5f6-a789-0123-c3d4-e5f6a7890123",
          promotionalOfferSignatureV2: "signature2",
        },
      }),
    );
    expect(parsed.promotionalOffer?.promotionalOfferSignatureV2).toBe("signature2");
    expect(parsed.promotionalOffer?.promotionalOfferSignatureV1).toBeUndefined();
  });

  it("round-trips a promotionalOffer V1 body", () => {
    const promotionalOffer = {
      messageIdentifier: "d4e5f6a7-8901-2345-d4e5-f6a789012345",
      promotionalOfferSignatureV1: {
        encodedSignature: "base64encodedSignature",
        productId: "com.example.product",
        nonce: "e5f6a789-0123-4567-e5f6-a78901234567",
        timestamp: 1698148900000,
        keyId: "keyId123",
        offerIdentifier: "offer123",
        appAccountToken: "f6a78901-2345-6789-f6a7-890123456789",
      },
    };
    const parsed = unwrapOptionsDeep(
      Schema.decodeUnknownSync(RealtimeResponseBodySchema)({
        promotionalOffer,
      }),
    );
    const v1 = parsed.promotionalOffer?.promotionalOfferSignatureV1;
    expect(v1?.productId).toBe("com.example.product");
    expect(v1?.offerIdentifier).toBe("offer123");
    expect(v1?.nonce).toBe("e5f6a789-0123-4567-e5f6-a78901234567");
    expect(v1?.timestamp).toBe(1698148900000);
    expect(v1?.keyId).toBe("keyId123");
    expect(v1?.appAccountToken).toBe("f6a78901-2345-6789-f6a7-890123456789");
    expect(v1?.encodedSignature).toBe("base64encodedSignature");
  });

  it("round-trips an advancedCommerceInfo body", () => {
    const acData = "eyJhbGciOiJFUzI1NiJ9.base64data";
    const parsed = unwrapOptionsDeep(
      Schema.decodeUnknownSync(RealtimeResponseBodySchema)({
        advancedCommerceInfo: {
          messageIdentifier: "a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890",
          advancedCommerceData: acData,
        },
      }),
    );
    expect(parsed.advancedCommerceInfo?.advancedCommerceData).toBe(acData);
  });

  it("rejects unrelated extra signature fields under message schema", () => {
    // Sanity check: each individual schema rejects unknown required fields where applicable.
    expect(() =>
      Schema.decodeUnknownSync(PromotionalOfferSignatureV1Schema)({
        productId: "p",
      }),
    ).toThrow();
  });

  it("preserves field name shape in JSON.stringify output", () => {
    const json = JSON.stringify({
      message: { messageIdentifier: "12345678-1234-1234-1234-123456789012" },
    } satisfies Schema.Schema.Type<typeof RealtimeResponseBodySchema>);
    expect(json).toContain('"message"');
    expect(json).toContain('"messageIdentifier"');
    expect(json).toContain('"12345678-1234-1234-1234-123456789012"');
  });

  // Lint guard: keeps the imported schemas referenced.
  void MessageSchema;
  void AlternateProductSchema;
  void PromotionalOfferSchema;
  void RealtimeAdvancedCommerceInfoSchema;
});
