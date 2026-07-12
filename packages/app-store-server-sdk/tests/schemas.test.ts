import { describe, it, expect } from "vitest";
import { Schema } from "effect";
import { unwrapOptionsDeep } from "./util.ts";
import {
  Environment,
  EnvironmentSchema,
  Status,
  StatusSchema,
  NotificationTypeV2,
  NotificationTypeV2Schema,
  Type,
  TypeSchema,
  OfferType,
  OfferTypeSchema,
} from "../src/schemas/enums.ts";
import {
  TransactionInfoResponseSchema,
  HistoryResponseSchema,
  StatusResponseSchema,
} from "../src/schemas/responses.ts";
import { ResponseBodyV2Schema } from "../src/schemas/notifications.ts";

describe("Enum Schema Tests", () => {
  it("should decode Environment enum values", () => {
    const result = unwrapOptionsDeep(Schema.decodeUnknownSync(EnvironmentSchema)("Production"));
    expect(result).toBe(Environment.PRODUCTION);

    const sandboxResult = unwrapOptionsDeep(Schema.decodeUnknownSync(EnvironmentSchema)("Sandbox"));
    expect(sandboxResult).toBe(Environment.SANDBOX);
  });

  it("should decode Status enum values", () => {
    const activeResult = unwrapOptionsDeep(Schema.decodeUnknownSync(StatusSchema)(1));
    expect(activeResult).toBe(Status.ACTIVE);

    const expiredResult = unwrapOptionsDeep(Schema.decodeUnknownSync(StatusSchema)(2));
    expect(expiredResult).toBe(Status.EXPIRED);
  });

  it("should decode NotificationTypeV2 enum values", () => {
    const subscribedResult = unwrapOptionsDeep(
      Schema.decodeUnknownSync(NotificationTypeV2Schema)("SUBSCRIBED"),
    );
    expect(subscribedResult).toBe(NotificationTypeV2.SUBSCRIBED);

    const expiredResult = unwrapOptionsDeep(
      Schema.decodeUnknownSync(NotificationTypeV2Schema)("EXPIRED"),
    );
    expect(expiredResult).toBe(NotificationTypeV2.EXPIRED);
  });

  it("should decode Type enum values", () => {
    const autoRenewableResult = unwrapOptionsDeep(
      Schema.decodeUnknownSync(TypeSchema)("Auto-Renewable Subscription"),
    );
    expect(autoRenewableResult).toBe(Type.AUTO_RENEWABLE_SUBSCRIPTION);

    const consumableResult = unwrapOptionsDeep(Schema.decodeUnknownSync(TypeSchema)("Consumable"));
    expect(consumableResult).toBe(Type.CONSUMABLE);
  });

  it("should decode OfferType enum values", () => {
    const introductoryResult = unwrapOptionsDeep(Schema.decodeUnknownSync(OfferTypeSchema)(1));
    expect(introductoryResult).toBe(OfferType.INTRODUCTORY_OFFER);

    const promotionalResult = unwrapOptionsDeep(Schema.decodeUnknownSync(OfferTypeSchema)(2));
    expect(promotionalResult).toBe(OfferType.PROMOTIONAL_OFFER);
  });
});

describe("Response Schema Tests", () => {
  it("should decode TransactionInfoResponse", () => {
    const response = {
      signedTransactionInfo: "some.signed.jwt",
    };

    const result = unwrapOptionsDeep(
      Schema.decodeUnknownSync(TransactionInfoResponseSchema)(response),
    );
    expect(result.signedTransactionInfo).toBe("some.signed.jwt");
  });

  it("should decode empty TransactionInfoResponse", () => {
    const response = {};
    const result = unwrapOptionsDeep(
      Schema.decodeUnknownSync(TransactionInfoResponseSchema)(response),
    );
    expect(result.signedTransactionInfo).toBeUndefined();
  });

  it("should decode HistoryResponse", () => {
    const response = {
      revision: "abc123",
      hasMore: true,
      bundleId: "com.example.app",
      appAppleId: 12345,
      environment: "Production",
      signedTransactions: ["jwt1", "jwt2"],
    };

    const result = unwrapOptionsDeep(Schema.decodeUnknownSync(HistoryResponseSchema)(response));
    expect(result.revision).toBe("abc123");
    expect(result.hasMore).toBe(true);
    expect(result.bundleId).toBe("com.example.app");
    expect(result.appAppleId).toBe(12345);
    expect(result.environment).toBe("Production");
    expect(result.signedTransactions).toEqual(["jwt1", "jwt2"]);
  });

  it("should decode StatusResponse", () => {
    const response = {
      environment: "Sandbox",
      bundleId: "com.example.app",
      appAppleId: 12345,
      data: [
        {
          subscriptionGroupIdentifier: "group1",
          lastTransactions: [
            {
              status: 1,
              originalTransactionId: "original123",
              signedTransactionInfo: "signed.transaction.info",
              signedRenewalInfo: "signed.renewal.info",
            },
          ],
        },
      ],
    };

    const result = unwrapOptionsDeep(Schema.decodeUnknownSync(StatusResponseSchema)(response));
    expect(result.environment).toBe("Sandbox");
    expect(result.bundleId).toBe("com.example.app");
    expect(result.data?.length).toBe(1);
    expect(result.data?.[0]?.subscriptionGroupIdentifier).toBe("group1");
    expect(result.data?.[0]?.lastTransactions?.length).toBe(1);
    expect(result.data?.[0]?.lastTransactions?.[0]?.status).toBe(1);
  });
});

describe("Notification Schema Tests", () => {
  it("should decode a ResponseBodyV2 signed payload", () => {
    const result = Schema.decodeUnknownSync(ResponseBodyV2Schema)({
      signedPayload: "aaa.bbb.ccc",
    });

    expect(result.signedPayload).toBe("aaa.bbb.ccc");
  });

  it("should accept any string signed payload", () => {
    const result = Schema.decodeUnknownSync(ResponseBodyV2Schema)({
      signedPayload: "plain-string",
    });

    expect(result.signedPayload).toBe("plain-string");
  });

  it("should reject a missing signed payload", () => {
    expect(() => Schema.decodeUnknownSync(ResponseBodyV2Schema)({})).toThrow();
  });

  it("should reject a non-string signed payload", () => {
    expect(() =>
      Schema.decodeUnknownSync(ResponseBodyV2Schema)({
        signedPayload: 123,
      }),
    ).toThrow();
  });
});
