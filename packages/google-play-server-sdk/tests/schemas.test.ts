/**
 * Unit tests for Google Play API schemas
 */

import { Effect, Exit, Schema } from "effect";
import { describe, expect, test } from "vitest";

import {
  SubscriptionState,
  AcknowledgementState,
  PurchaseState,
  ConsumptionState,
  SubscriptionPurchaseV2,
  SubscriptionPurchaseLineItem,
  ProductPurchaseV2,
  ProductPurchase,
  VoidedPurchase,
  VoidedPurchasesListResponse,
  DeveloperNotification,
  SubscriptionNotification,
  OneTimeProductNotification,
  VoidedPurchaseNotification,
  TestNotification,
} from "../src/schemas";

describe("Google Play API Schemas", () => {
  describe("Enums", () => {
    describe("SubscriptionState", () => {
      test("should decode valid subscription states", () =>
        Effect.runPromise(
          Effect.gen(function* () {
            const validStates = [
              "SUBSCRIPTION_STATE_UNSPECIFIED",
              "SUBSCRIPTION_STATE_PENDING",
              "SUBSCRIPTION_STATE_ACTIVE",
              "SUBSCRIPTION_STATE_PAUSED",
              "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
              "SUBSCRIPTION_STATE_ON_HOLD",
              "SUBSCRIPTION_STATE_CANCELED",
              "SUBSCRIPTION_STATE_EXPIRED",
              "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED",
            ];

            for (const state of validStates) {
              const result = yield* Effect.exit(
                Schema.decodeUnknownEffect(SubscriptionState)(state),
              );
              expect(Exit.isSuccess(result)).toBe(true);
            }
          }),
        ));

      test("should fail for invalid subscription state", () =>
        Effect.runPromise(
          Effect.gen(function* () {
            const result = yield* Effect.exit(
              Schema.decodeUnknownEffect(SubscriptionState)("INVALID_STATE"),
            );
            expect(Exit.isFailure(result)).toBe(true);
          }),
        ));
    });

    describe("AcknowledgementState", () => {
      test("should decode valid acknowledgement states", () =>
        Effect.runPromise(
          Effect.gen(function* () {
            const validStates = [
              "ACKNOWLEDGEMENT_STATE_UNSPECIFIED",
              "ACKNOWLEDGEMENT_STATE_PENDING",
              "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
            ];

            for (const state of validStates) {
              const result = yield* Effect.exit(
                Schema.decodeUnknownEffect(AcknowledgementState)(state),
              );
              expect(Exit.isSuccess(result)).toBe(true);
            }
          }),
        ));
    });

    describe("PurchaseState", () => {
      test("should decode valid purchase states", () =>
        Effect.runPromise(
          Effect.gen(function* () {
            const validStates = ["PURCHASE_STATE_UNSPECIFIED", "PURCHASED", "PENDING", "CANCELLED"];

            for (const state of validStates) {
              const result = yield* Effect.exit(
                Schema.decodeUnknownEffect(PurchaseState)(state),
              );
              expect(Exit.isSuccess(result)).toBe(true);
            }
          }),
        ));
    });

    describe("ConsumptionState", () => {
      test("should decode valid consumption states", () =>
        Effect.runPromise(
          Effect.gen(function* () {
            const validStates = [
              "CONSUMPTION_STATE_UNSPECIFIED",
              "CONSUMPTION_STATE_YET_TO_BE_CONSUMED",
              "CONSUMPTION_STATE_CONSUMED",
            ];

            for (const state of validStates) {
              const result = yield* Effect.exit(
                Schema.decodeUnknownEffect(ConsumptionState)(state),
              );
              expect(Exit.isSuccess(result)).toBe(true);
            }
          }),
        ));
    });
  });

  describe("SubscriptionPurchaseLineItem", () => {
    test("should decode minimal line item", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const lineItem = {
            productId: "com.example.subscription.monthly",
            expiryTime: "2024-12-31T23:59:59Z",
          };

          const result = yield* Effect.exit(
            Schema.decodeUnknownEffect(SubscriptionPurchaseLineItem)(lineItem),
          );

          expect(Exit.isSuccess(result)).toBe(true);
          if (Exit.isSuccess(result)) {
            expect(result.value.productId).toBe("com.example.subscription.monthly");
            expect(result.value.expiryTime).toBe("2024-12-31T23:59:59Z");
          }
        }),
      ));

    test("should decode line item with all fields", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const lineItem = {
            productId: "com.example.subscription.monthly",
            expiryTime: "2024-12-31T23:59:59Z",
            autoRenewingPlan: {
              autoRenewEnabled: true,
            },
            offerDetails: {
              offerId: "introductory_offer",
              basePlanId: "monthly_plan",
            },
          };

          const result = yield* Effect.exit(
            Schema.decodeUnknownEffect(SubscriptionPurchaseLineItem)(lineItem),
          );

          expect(Exit.isSuccess(result)).toBe(true);
          if (Exit.isSuccess(result)) {
            expect(result.value.autoRenewingPlan?.autoRenewEnabled).toBe(true);
            expect(result.value.offerDetails?.offerId).toBe("introductory_offer");
          }
        }),
      ));
  });

  describe("SubscriptionPurchaseV2", () => {
    test("should decode minimal subscription purchase", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const purchase = {
            subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
            acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
          };

          const result = yield* Effect.exit(
            Schema.decodeUnknownEffect(SubscriptionPurchaseV2)(purchase),
          );

          expect(Exit.isSuccess(result)).toBe(true);
          if (Exit.isSuccess(result)) {
            expect(result.value.subscriptionState).toBe("SUBSCRIPTION_STATE_ACTIVE");
            expect(result.value.acknowledgementState).toBe("ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED");
          }
        }),
      ));

    test("should decode full subscription purchase", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const purchase = {
            subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
            acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
            lineItems: [
              {
                productId: "com.example.subscription.monthly",
                expiryTime: "2024-12-31T23:59:59Z",
              },
            ],
            startTime: "2024-01-01T00:00:00Z",
            regionCode: "US",
            latestOrderId: "GPA.1234-5678-9012-34567",
            linkedPurchaseToken: "old_purchase_token",
            kind: "androidpublisher#subscriptionPurchaseV2",
            testPurchase: {},
          };

          const result = yield* Effect.exit(
            Schema.decodeUnknownEffect(SubscriptionPurchaseV2)(purchase),
          );

          expect(Exit.isSuccess(result)).toBe(true);
          if (Exit.isSuccess(result)) {
            expect(result.value.lineItems).toHaveLength(1);
            expect(result.value.regionCode).toBe("US");
            expect(result.value.latestOrderId).toBe("GPA.1234-5678-9012-34567");
          }
        }),
      ));
  });

  describe("ProductPurchaseV2", () => {
    test("should decode minimal product purchase", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const purchase = {
            acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
          };

          const result = yield* Effect.exit(
            Schema.decodeUnknownEffect(ProductPurchaseV2)(purchase),
          );

          expect(Exit.isSuccess(result)).toBe(true);
          if (Exit.isSuccess(result)) {
            expect(result.value.acknowledgementState).toBe("ACKNOWLEDGEMENT_STATE_PENDING");
          }
        }),
      ));

    test("should decode full product purchase", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const purchase = {
            acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
            purchaseStateContext: {
              purchaseState: "PURCHASED",
            },
            productLineItem: [
              {
                productId: "com.example.consumable.coins",
                quantity: 100,
              },
            ],
            orderId: "GPA.1234-5678-9012-34567",
            purchaseCompletionTime: "2024-06-15T10:30:00Z",
            regionCode: "US",
          };

          const result = yield* Effect.exit(
            Schema.decodeUnknownEffect(ProductPurchaseV2)(purchase),
          );

          expect(Exit.isSuccess(result)).toBe(true);
          if (Exit.isSuccess(result)) {
            expect(result.value.purchaseStateContext?.purchaseState).toBe("PURCHASED");
            expect(result.value.productLineItem).toHaveLength(1);
            expect(result.value.regionCode).toBe("US");
          }
        }),
      ));
  });

  describe("ProductPurchase (Legacy)", () => {
    test("should decode legacy product purchase", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const purchase = {
            purchaseState: 0,
            consumptionState: 1,
            purchaseTimeMillis: "1718451000000",
            orderId: "GPA.1234-5678-9012-34567",
            kind: "androidpublisher#productPurchase",
          };

          const result = yield* Effect.exit(
            Schema.decodeUnknownEffect(ProductPurchase)(purchase),
          );

          expect(Exit.isSuccess(result)).toBe(true);
          if (Exit.isSuccess(result)) {
            expect(result.value.purchaseState).toBe(0);
            expect(result.value.consumptionState).toBe(1);
            expect(result.value.purchaseTimeMillis).toBe("1718451000000");
          }
        }),
      ));

    test("should handle developer payload", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const purchase = {
            purchaseState: 0,
            consumptionState: 0,
            purchaseTimeMillis: "1718451000000",
            developerPayload: "custom_user_data",
          };

          const result = yield* Effect.exit(
            Schema.decodeUnknownEffect(ProductPurchase)(purchase),
          );

          expect(Exit.isSuccess(result)).toBe(true);
          if (Exit.isSuccess(result)) {
            expect(result.value.developerPayload).toBe("custom_user_data");
          }
        }),
      ));
  });

  describe("VoidedPurchase", () => {
    test("should decode voided purchase", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const voidedPurchase = {
            purchaseToken: "token123",
            voidedTimeMillis: "1718451000000",
            orderId: "GPA.1234-5678-9012-34567",
            voidedSource: 0,
            voidedReason: 1,
            kind: "androidpublisher#voidedPurchase",
          };

          const result = yield* Effect.exit(
            Schema.decodeUnknownEffect(VoidedPurchase)(voidedPurchase),
          );

          expect(Exit.isSuccess(result)).toBe(true);
          if (Exit.isSuccess(result)) {
            expect(result.value.purchaseToken).toBe("token123");
            expect(result.value.voidedSource).toBe(0);
            expect(result.value.voidedReason).toBe(1);
          }
        }),
      ));
  });

  describe("VoidedPurchasesListResponse", () => {
    test("should decode voided purchases list", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const response = {
            voidedPurchases: [
              {
                purchaseToken: "token1",
                voidedTimeMillis: "1718451000000",
                orderId: "order1",
                voidedReason: 1,
              },
              {
                purchaseToken: "token2",
                voidedTimeMillis: "1718452000000",
                orderId: "order2",
                voidedReason: 2,
              },
            ],
          };

          const result = yield* Effect.exit(
            Schema.decodeUnknownEffect(VoidedPurchasesListResponse)(response),
          );

          expect(Exit.isSuccess(result)).toBe(true);
          if (Exit.isSuccess(result)) {
            expect(result.value.voidedPurchases).toHaveLength(2);
          }
        }),
      ));

    test("should decode response with pagination", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const response = {
            voidedPurchases: [],
            tokenPagination: {
              nextPageToken: "next_token_123",
            },
          };

          const result = yield* Effect.exit(
            Schema.decodeUnknownEffect(VoidedPurchasesListResponse)(response),
          );

          expect(Exit.isSuccess(result)).toBe(true);
          if (Exit.isSuccess(result)) {
            expect(result.value.tokenPagination?.nextPageToken).toBe("next_token_123");
          }
        }),
      ));
  });

  describe("RTDN Notification Schemas", () => {
    describe("SubscriptionNotification", () => {
      test("should decode subscription notification", () =>
        Effect.runPromise(
          Effect.gen(function* () {
            const notification = {
              version: "1.0",
              notificationType: 4,
              purchaseToken: "purchase_token_123",
              subscriptionId: "com.example.subscription.monthly",
            };

            const result = yield* Effect.exit(
              Schema.decodeUnknownEffect(SubscriptionNotification)(notification),
            );

            expect(Exit.isSuccess(result)).toBe(true);
            if (Exit.isSuccess(result)) {
              expect(result.value.notificationType).toBe(4);
              expect(result.value.purchaseToken).toBe("purchase_token_123");
              expect(result.value.subscriptionId).toBe("com.example.subscription.monthly");
            }
          }),
        ));
    });

    describe("OneTimeProductNotification", () => {
      test("should decode one-time product notification", () =>
        Effect.runPromise(
          Effect.gen(function* () {
            const notification = {
              version: "1.0",
              notificationType: 1,
              purchaseToken: "purchase_token_456",
              sku: "com.example.consumable.coins",
            };

            const result = yield* Effect.exit(
              Schema.decodeUnknownEffect(OneTimeProductNotification)(notification),
            );

            expect(Exit.isSuccess(result)).toBe(true);
            if (Exit.isSuccess(result)) {
              expect(result.value.notificationType).toBe(1);
              expect(result.value.sku).toBe("com.example.consumable.coins");
            }
          }),
        ));
    });

    describe("VoidedPurchaseNotification", () => {
      test("should decode voided purchase notification", () =>
        Effect.runPromise(
          Effect.gen(function* () {
            const notification = {
              purchaseToken: "purchase_token_789",
              orderId: "GPA.1234-5678-9012-34567",
              productType: 1,
              refundType: 1,
            };

            const result = yield* Effect.exit(
              Schema.decodeUnknownEffect(VoidedPurchaseNotification)(notification),
            );

            expect(Exit.isSuccess(result)).toBe(true);
            if (Exit.isSuccess(result)) {
              expect(result.value.purchaseToken).toBe("purchase_token_789");
              expect(result.value.productType).toBe(1);
              expect(result.value.refundType).toBe(1);
            }
          }),
        ));
    });

    describe("TestNotification", () => {
      test("should decode test notification", () =>
        Effect.runPromise(
          Effect.gen(function* () {
            const notification = {
              version: "1.0",
            };

            const result = yield* Effect.exit(
              Schema.decodeUnknownEffect(TestNotification)(notification),
            );

            expect(Exit.isSuccess(result)).toBe(true);
            if (Exit.isSuccess(result)) {
              expect(result.value.version).toBe("1.0");
            }
          }),
        ));
    });

    describe("DeveloperNotification", () => {
      test("should decode subscription developer notification", () =>
        Effect.runPromise(
          Effect.gen(function* () {
            const notification = {
              version: "1.0",
              packageName: "com.example.app",
              eventTimeMillis: "1718451000000",
              subscriptionNotification: {
                version: "1.0",
                notificationType: 4,
                purchaseToken: "purchase_token_123",
                subscriptionId: "com.example.subscription.monthly",
              },
            };

            const result = yield* Effect.exit(
              Schema.decodeUnknownEffect(DeveloperNotification)(notification),
            );

            expect(Exit.isSuccess(result)).toBe(true);
            if (Exit.isSuccess(result)) {
              expect(result.value.packageName).toBe("com.example.app");
              expect(result.value.subscriptionNotification).toBeDefined();
              expect(result.value.oneTimeProductNotification).toBeUndefined();
            }
          }),
        ));

      test("should decode one-time product developer notification", () =>
        Effect.runPromise(
          Effect.gen(function* () {
            const notification = {
              version: "1.0",
              packageName: "com.example.app",
              eventTimeMillis: "1718451000000",
              oneTimeProductNotification: {
                version: "1.0",
                notificationType: 1,
                purchaseToken: "purchase_token_456",
                sku: "com.example.consumable.coins",
              },
            };

            const result = yield* Effect.exit(
              Schema.decodeUnknownEffect(DeveloperNotification)(notification),
            );

            expect(Exit.isSuccess(result)).toBe(true);
            if (Exit.isSuccess(result)) {
              expect(result.value.oneTimeProductNotification).toBeDefined();
              expect(result.value.subscriptionNotification).toBeUndefined();
            }
          }),
        ));

      test("should decode test developer notification", () =>
        Effect.runPromise(
          Effect.gen(function* () {
            const notification = {
              version: "1.0",
              packageName: "com.example.app",
              eventTimeMillis: "1718451000000",
              testNotification: {
                version: "1.0",
              },
            };

            const result = yield* Effect.exit(
              Schema.decodeUnknownEffect(DeveloperNotification)(notification),
            );

            expect(Exit.isSuccess(result)).toBe(true);
            if (Exit.isSuccess(result)) {
              expect(result.value.testNotification).toBeDefined();
            }
          }),
        ));

      test("should decode voided purchase developer notification", () =>
        Effect.runPromise(
          Effect.gen(function* () {
            const notification = {
              version: "1.0",
              packageName: "com.example.app",
              eventTimeMillis: "1718451000000",
              voidedPurchaseNotification: {
                purchaseToken: "purchase_token_789",
                orderId: "GPA.1234-5678-9012-34567",
                productType: 1,
                refundType: 1,
              },
            };

            const result = yield* Effect.exit(
              Schema.decodeUnknownEffect(DeveloperNotification)(notification),
            );

            expect(Exit.isSuccess(result)).toBe(true);
            if (Exit.isSuccess(result)) {
              expect(result.value.voidedPurchaseNotification).toBeDefined();
            }
          }),
        ));
    });
  });
});
