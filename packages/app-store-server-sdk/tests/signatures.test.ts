import { describe, it, expect } from "vitest";
import { Effect } from "effect";
import { TEST_SIGNING_KEY } from "./util";
import {
  createPromotionalOfferV2Signature,
  createIntroductoryOfferEligibilitySignature,
  createAdvancedCommerceInAppSignature,
} from "../src/signatures/index.ts";
import { createPromotionalOfferV1Signature } from "../src/signatures/index.ts";

describe("JWS Signature Creator Checks", () => {
  it("should create a promotional offer V2 signature", async () => {
    const config = {
      signingKey: TEST_SIGNING_KEY,
      keyId: "keyId",
      issuerId: "issuerId",
      bundleId: "bundleId",
    };

    const signature = await Effect.runPromise(
      createPromotionalOfferV2Signature(config, "productId", "offerIdentifier", "transactionId"),
    );

    expect(signature).toBeTruthy();

    const parts = signature.split(".");
    expect(parts.length).toBe(3);

    const header = JSON.parse(Buffer.from(parts[0]!, "base64url").toString());
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString());

    // Header
    expect(header.typ).toBe("JWT");
    expect(header.alg).toBe("ES256");
    expect(header.kid).toBe("keyId");

    // Payload
    expect(payload.iss).toBe("issuerId");
    expect(payload.iat).toBeTruthy();
    expect(payload.exp).toBeUndefined();
    expect(payload.aud).toBe("promotional-offer");
    expect(payload.bid).toBe("bundleId");
    expect(payload.nonce).toBeTruthy();
    expect(payload.productId).toBe("productId");
    expect(payload.offerIdentifier).toBe("offerIdentifier");
    expect(payload.transactionId).toBe("transactionId");
  });

  it("should create a promotional offer V2 signature without a transaction id", async () => {
    const config = {
      signingKey: TEST_SIGNING_KEY,
      keyId: "keyId",
      issuerId: "issuerId",
      bundleId: "bundleId",
    };

    const signature = await Effect.runPromise(
      createPromotionalOfferV2Signature(config, "productId", "offerIdentifier"),
    );

    const payload = JSON.parse(Buffer.from(signature.split(".")[1]!, "base64url").toString());
    expect(payload.transactionId).toBeUndefined();
  });

  it("should create an introductory eligibility offer signature", async () => {
    const config = {
      signingKey: TEST_SIGNING_KEY,
      keyId: "keyId",
      issuerId: "issuerId",
      bundleId: "bundleId",
    };

    const signature = await Effect.runPromise(
      createIntroductoryOfferEligibilitySignature(config, "productId", true, "transactionId"),
    );

    expect(signature).toBeTruthy();

    const parts = signature.split(".");
    const header = JSON.parse(Buffer.from(parts[0]!, "base64url").toString());
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString());

    // Header
    expect(header.typ).toBe("JWT");
    expect(header.alg).toBe("ES256");
    expect(header.kid).toBe("keyId");

    // Payload
    expect(payload.iss).toBe("issuerId");
    expect(payload.iat).toBeTruthy();
    expect(payload.exp).toBeUndefined();
    expect(payload.aud).toBe("introductory-offer-eligibility");
    expect(payload.bid).toBe("bundleId");
    expect(payload.nonce).toBeTruthy();
    expect(payload.productId).toBe("productId");
    expect(payload.allowIntroductoryOffer).toBe(true);
    expect(payload.transactionId).toBe("transactionId");
  });

  it("should create an Advanced Commerce in app signature", async () => {
    const config = {
      signingKey: TEST_SIGNING_KEY,
      keyId: "keyId",
      issuerId: "issuerId",
      bundleId: "bundleId",
    };

    const request = {
      testValue: "testValue",
    };

    const signature = await Effect.runPromise(
      createAdvancedCommerceInAppSignature(config, request),
    );

    expect(signature).toBeTruthy();

    const parts = signature.split(".");
    const header = JSON.parse(Buffer.from(parts[0]!, "base64url").toString());
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString());

    // Header
    expect(header.typ).toBe("JWT");
    expect(header.alg).toBe("ES256");
    expect(header.kid).toBe("keyId");

    // Payload
    expect(payload.iss).toBe("issuerId");
    expect(payload.iat).toBeTruthy();
    expect(payload.exp).toBeUndefined();
    expect(payload.aud).toBe("advanced-commerce-api");
    expect(payload.bid).toBe("bundleId");
    expect(payload.nonce).toBeTruthy();

    const parsedRequestJson = Buffer.from(payload.request, "base64").toString("utf-8");
    const parsedRequest = JSON.parse(parsedRequestJson);
    expect(parsedRequest.testValue).toBe("testValue");
  });

  it("should create a V1 promotional offer signature", async () => {
    const config = {
      signingKey: TEST_SIGNING_KEY,
      keyId: "keyId",
      bundleId: "bundleId",
    };

    const signature = await Effect.runPromise(
      createPromotionalOfferV1Signature(
        config,
        "productId",
        "offerId",
        "appAccountToken",
        "20fba8a0-2b80-4a7d-a17f-85c1854727f8",
        1698148900000,
      ),
    );

    // V1 signature is base64 encoded, not a JWT
    expect(signature).toBeTruthy();
    expect(signature.includes(".")).toBe(false);
    // The output is valid base64
    expect(() => Buffer.from(signature, "base64")).not.toThrow();
  });
});
