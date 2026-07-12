import { Effect } from "effect";

import { describe, expect, it } from "../../../testing/effect-vitest.ts";
import {
  isSubscriptionActivatedNotification,
  isSubscriptionCancellationNotification,
  isSubscriptionRenewalNotification,
  parseAndCategorizeNotification,
} from "./notifications.ts";

/** Wraps a DeveloperNotification in a base64 Pub/Sub push envelope. */
const envelope = (developerNotification: unknown, messageId = "m-1") => ({
  message: {
    data: btoa(JSON.stringify(developerNotification)),
    messageId,
    publishTime: "2024-02-15T12:00:00.000Z",
  },
  subscription: "projects/p/subscriptions/s",
});

describe("parseAndCategorizeNotification", () => {
  it.effect("decodes a subscription notification", () =>
    Effect.gen(function* () {
      const decoded = yield* parseAndCategorizeNotification(
        envelope({
          eventTimeMillis: "1707998400000",
          packageName: "com.example.app",
          subscriptionNotification: {
            notificationType: 4,
            purchaseToken: "tok_sub",
            subscriptionId: "premium.monthly",
            version: "1.0",
          },
          version: "1.0",
        }),
      );
      expect(decoded.type).toBe("subscription");
      if (decoded.type === "subscription") {
        expect(decoded.notificationType).toBe(4);
        expect(decoded.notificationTypeName).toBe("SUBSCRIPTION_PURCHASED");
        expect(decoded.purchaseToken).toBe("tok_sub");
        expect(decoded.subscriptionId).toBe("premium.monthly");
        expect(decoded.packageName).toBe("com.example.app");
      }
    }),
  );

  it.effect("decodes a one-time product notification", () =>
    Effect.gen(function* () {
      const decoded = yield* parseAndCategorizeNotification(
        envelope({
          oneTimeProductNotification: {
            notificationType: 1,
            purchaseToken: "tok_otp",
            sku: "coins_100",
            version: "1.0",
          },
          packageName: "com.example.app",
        }),
      );
      expect(decoded.type).toBe("oneTimeProduct");
      if (decoded.type === "oneTimeProduct") {
        expect(decoded.notificationTypeName).toBe("ONE_TIME_PRODUCT_PURCHASED");
        expect(decoded.sku).toBe("coins_100");
        expect(decoded.purchaseToken).toBe("tok_otp");
      }
    }),
  );

  it.effect("decodes a voided purchase notification", () =>
    Effect.gen(function* () {
      const decoded = yield* parseAndCategorizeNotification(
        envelope({
          packageName: "com.example.app",
          voidedPurchaseNotification: {
            orderId: "GPA.VOID.1",
            productType: 1,
            purchaseToken: "tok_void",
            refundType: 1,
          },
        }),
      );
      expect(decoded.type).toBe("voidedPurchase");
      if (decoded.type === "voidedPurchase") {
        expect(decoded.orderId).toBe("GPA.VOID.1");
        expect(decoded.productType).toBe(1);
        expect(decoded.refundType).toBe(1);
      }
    }),
  );

  it.effect("decodes a test notification", () =>
    Effect.gen(function* () {
      const decoded = yield* parseAndCategorizeNotification(
        envelope({ packageName: "com.example.app", testNotification: { version: "1.0" } }),
      );
      expect(decoded.type).toBe("test");
    }),
  );

  it.effect("fails with an invalid-notification error on non-JSON payload data", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        parseAndCategorizeNotification({
          message: { data: btoa("this is not json") },
        }),
      );
      expect((error as { _tag: string })._tag).toBe("GooglePlayInvalidNotificationError");
    }),
  );

  it.effect("fails when the envelope structure is invalid", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(parseAndCategorizeNotification({ not: "a pubsub message" }));
      expect((error as { _tag: string })._tag).toBe("GooglePlayInvalidNotificationError");
    }),
  );
});

describe("subscription notification predicates", () => {
  it.effect("classifies activation, renewal, and cancellation notification types", () =>
    Effect.gen(function* () {
      const make = (notificationType: number) =>
        parseAndCategorizeNotification(
          envelope({
            packageName: "com.example.app",
            subscriptionNotification: {
              notificationType,
              purchaseToken: "tok",
              subscriptionId: "premium.monthly",
            },
          }),
        );

      const purchased = yield* make(4);
      const renewed = yield* make(2);
      const expired = yield* make(13);

      expect(isSubscriptionActivatedNotification(purchased)).toBe(true);
      expect(isSubscriptionRenewalNotification(renewed)).toBe(true);
      expect(isSubscriptionCancellationNotification(expired)).toBe(true);
      expect(isSubscriptionRenewalNotification(purchased)).toBe(false);
    }),
  );
});
