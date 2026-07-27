import {
  InAppOwnershipType,
  type JWSRenewalInfoDecodedPayload,
  type JWSTransactionDecodedPayload,
  RevocationType,
} from "@voidhash/app-store-server-sdk";
import { Effect, Option } from "effect";

import { describe, expect, it } from "../../../testing/effect-vitest.ts";
import { AppStorePurchaseProcessingIdempotencyKeyDerivationError } from "./errors.ts";
import {
  classifyAppStoreRevocation,
  getAppStorePersonIdentifier,
  getAppStorePurchaseProcessingIdempotencyKey,
  getAppStoreProviderSubscriptionId,
  getAppStoreProviderTransactionId,
} from "./helpers.ts";

/**
 * Builds a minimal `JWSTransactionDecodedPayload` shape for unit tests. Every
 * field is an `Option`, so unspecified ones default to `Option.none()`.
 */
const decoded = (
  overrides: Partial<JWSTransactionDecodedPayload> = {},
): JWSTransactionDecodedPayload =>
  ({
    advancedCommerceInfo: Option.none(),
    appAccountToken: Option.none(),
    appTransactionId: Option.none(),
    billingPlanType: Option.none(),
    bundleId: Option.none(),
    commitmentInfo: Option.none(),
    currency: Option.none(),
    environment: Option.none(),
    expiresDate: Option.none(),
    inAppOwnershipType: Option.none(),
    isUpgraded: Option.none(),
    offerDiscountType: Option.none(),
    offerIdentifier: Option.none(),
    offerPeriod: Option.none(),
    offerType: Option.none(),
    originalPurchaseDate: Option.none(),
    originalTransactionId: Option.none(),
    price: Option.none(),
    productId: Option.none(),
    purchaseDate: Option.none(),
    quantity: Option.none(),
    revocationDate: Option.none(),
    revocationPercentage: Option.none(),
    revocationReason: Option.none(),
    revocationType: Option.none(),
    signedDate: Option.none(),
    storefront: Option.none(),
    storefrontId: Option.none(),
    subscriptionGroupIdentifier: Option.none(),
    transactionId: Option.none(),
    transactionReason: Option.none(),
    type: Option.none(),
    webOrderLineItemId: Option.none(),
    ...overrides,
  }) satisfies JWSTransactionDecodedPayload;

const renewalInfo = (
  overrides: Partial<JWSRenewalInfoDecodedPayload> = {},
): JWSRenewalInfoDecodedPayload =>
  ({
    advancedCommerceInfo: Option.none(),
    appAccountToken: Option.none(),
    appTransactionId: Option.none(),
    autoRenewProductId: Option.none(),
    autoRenewStatus: Option.none(),
    commitmentInfo: Option.none(),
    currency: Option.none(),
    eligibleWinBackOfferIds: Option.none(),
    environment: Option.none(),
    expirationIntent: Option.none(),
    gracePeriodExpiresDate: Option.none(),
    isInBillingRetryPeriod: Option.none(),
    offerDiscountType: Option.none(),
    offerIdentifier: Option.none(),
    offerPeriod: Option.none(),
    offerType: Option.none(),
    originalTransactionId: Option.none(),
    priceIncreaseStatus: Option.none(),
    productId: Option.none(),
    recentSubscriptionStartDate: Option.none(),
    renewalBillingPlanType: Option.none(),
    renewalDate: Option.none(),
    renewalPrice: Option.none(),
    signedDate: Option.none(),
    ...overrides,
  }) satisfies JWSRenewalInfoDecodedPayload;

describe("getAppStoreProviderTransactionId", () => {
  it("prefers the decoded JWS transactionId", () => {
    const result = getAppStoreProviderTransactionId({
      decodedTransaction: decoded({ transactionId: Option.some("tx_decoded") }),
      sdkTransactionId: "tx_sdk",
    });
    expect(result).toEqual(Option.some("tx_decoded"));
  });

  it("falls back to the SDK-observed transactionId when the JWS has none", () => {
    const result = getAppStoreProviderTransactionId({
      decodedTransaction: decoded(),
      sdkTransactionId: "tx_sdk",
    });
    expect(result).toEqual(Option.some("tx_sdk"));
  });

  it("returns Option.none when neither id is available", () => {
    const result = getAppStoreProviderTransactionId({ decodedTransaction: decoded() });
    expect(result).toEqual(Option.none());
  });
});

describe("getAppStoreProviderSubscriptionId", () => {
  it("returns the decoded originalTransactionId when present", () => {
    expect(
      getAppStoreProviderSubscriptionId(
        decoded({ originalTransactionId: Option.some("original_tx") }),
      ),
    ).toEqual(Option.some("original_tx"));
  });

  it("returns Option.none when originalTransactionId is absent", () => {
    expect(getAppStoreProviderSubscriptionId(decoded())).toEqual(Option.none());
  });
});

describe("getAppStorePurchaseProcessingIdempotencyKey", () => {
  const PURCHASE_DATE = 1_705_320_000_000; // 2024-01-15T12:00:00Z
  const EXPIRES_DATE = 1_707_998_400_000; // 2024-02-15T12:00:00Z
  const REVOCATION_DATE = 1_708_516_800_000; // 2024-02-21T12:00:00Z
  const RENEWAL_DATE = 1_710_590_400_000; // 2024-03-15T12:00:00Z

  it.effect("derives a purchase key from transactionId + purchaseDate", () =>
    Effect.gen(function* () {
      const key = yield* getAppStorePurchaseProcessingIdempotencyKey({
        decodedTransaction: decoded({
          purchaseDate: Option.some(PURCHASE_DATE),
          transactionId: Option.some("tx_decoded"),
        }),
        eventType: "purchase",
      });
      expect(key).toBe(`apple:tx_decoded:purchase:${PURCHASE_DATE}`);
    }),
  );

  it.effect("is stable across sources for the same logical purchase", () =>
    Effect.gen(function* () {
      const fromWebhook = yield* getAppStorePurchaseProcessingIdempotencyKey({
        decodedTransaction: decoded({
          purchaseDate: Option.some(PURCHASE_DATE),
          signedDate: Option.some(PURCHASE_DATE + 10),
          transactionId: Option.some("tx_shared"),
        }),
        eventType: "purchase",
      });
      const fromSdk = yield* getAppStorePurchaseProcessingIdempotencyKey({
        decodedTransaction: decoded({
          purchaseDate: Option.some(PURCHASE_DATE),
          signedDate: Option.some(PURCHASE_DATE + 7_200_000),
          transactionId: Option.some("tx_shared"),
        }),
        eventType: "purchase",
      });
      expect(fromWebhook).toBe(fromSdk);
    }),
  );

  it.effect("falls back to sdkTransactionId when decoded transactionId is absent", () =>
    Effect.gen(function* () {
      const key = yield* getAppStorePurchaseProcessingIdempotencyKey({
        decodedTransaction: decoded({ purchaseDate: Option.some(PURCHASE_DATE) }),
        eventType: "purchase",
        sdkTransactionId: "tx_sdk",
      });
      expect(key).toBe(`apple:tx_sdk:purchase:${PURCHASE_DATE}`);
    }),
  );

  it.effect("derives a renewal key separately from a purchase against the same id", () =>
    Effect.gen(function* () {
      const purchaseKey = yield* getAppStorePurchaseProcessingIdempotencyKey({
        decodedTransaction: decoded({
          purchaseDate: Option.some(PURCHASE_DATE),
          transactionId: Option.some("tx_same"),
        }),
        eventType: "purchase",
      });
      const renewalKey = yield* getAppStorePurchaseProcessingIdempotencyKey({
        decodedTransaction: decoded({
          purchaseDate: Option.some(PURCHASE_DATE),
          transactionId: Option.some("tx_same"),
        }),
        eventType: "renewal",
      });
      expect(purchaseKey).not.toBe(renewalKey);
    }),
  );

  it.effect("derives an expired key from originalTransactionId + expiresDate", () =>
    Effect.gen(function* () {
      const key = yield* getAppStorePurchaseProcessingIdempotencyKey({
        decodedTransaction: decoded({
          expiresDate: Option.some(EXPIRES_DATE),
          originalTransactionId: Option.some("original_tx"),
        }),
        eventType: "expired",
      });
      expect(key).toBe(`apple:original_tx:expired:${EXPIRES_DATE}`);
    }),
  );

  it.effect("derives distinct cancel keys per period for the same subscription series", () =>
    Effect.gen(function* () {
      const firstPeriod = yield* getAppStorePurchaseProcessingIdempotencyKey({
        decodedTransaction: decoded({
          expiresDate: Option.some(EXPIRES_DATE),
          originalTransactionId: Option.some("original_tx"),
        }),
        eventType: "canceled",
      });
      const secondPeriod = yield* getAppStorePurchaseProcessingIdempotencyKey({
        decodedTransaction: decoded({
          expiresDate: Option.some(EXPIRES_DATE + 30 * 24 * 3_600_000),
          originalTransactionId: Option.some("original_tx"),
        }),
        eventType: "canceled",
      });
      expect(firstPeriod).not.toBe(secondPeriod);
    }),
  );

  it.effect("derives a full-refund key with the default revocationPercentage suffix", () =>
    Effect.gen(function* () {
      const key = yield* getAppStorePurchaseProcessingIdempotencyKey({
        decodedTransaction: decoded({
          revocationDate: Option.some(REVOCATION_DATE),
          transactionId: Option.some("tx_full_refund"),
        }),
        eventType: "refund",
      });
      expect(key).toBe(`apple:tx_full_refund:refund:${REVOCATION_DATE}:100000`);
    }),
  );

  it.effect("derives distinct keys for partial refunds at the same revocationDate", () =>
    Effect.gen(function* () {
      const firstPartial = yield* getAppStorePurchaseProcessingIdempotencyKey({
        decodedTransaction: decoded({
          revocationDate: Option.some(REVOCATION_DATE),
          revocationPercentage: Option.some(25_000),
          transactionId: Option.some("tx_partial"),
        }),
        eventType: "refund",
      });
      const secondPartial = yield* getAppStorePurchaseProcessingIdempotencyKey({
        decodedTransaction: decoded({
          revocationDate: Option.some(REVOCATION_DATE),
          revocationPercentage: Option.some(50_000),
          transactionId: Option.some("tx_partial"),
        }),
        eventType: "refund",
      });
      expect(firstPartial).not.toBe(secondPartial);
    }),
  );

  it.effect("returns identical keys for two deliveries of the same partial refund", () =>
    Effect.gen(function* () {
      const first = yield* getAppStorePurchaseProcessingIdempotencyKey({
        decodedTransaction: decoded({
          revocationDate: Option.some(REVOCATION_DATE),
          revocationPercentage: Option.some(33_000),
          transactionId: Option.some("tx_dup"),
        }),
        eventType: "refund",
      });
      const second = yield* getAppStorePurchaseProcessingIdempotencyKey({
        decodedTransaction: decoded({
          revocationDate: Option.some(REVOCATION_DATE),
          revocationPercentage: Option.some(33_000),
          transactionId: Option.some("tx_dup"),
        }),
        eventType: "refund",
      });
      expect(first).toBe(second);
    }),
  );

  it.effect("derives a refund-reversal key from stable transaction anchors", () =>
    Effect.gen(function* () {
      const fromWebhook = yield* getAppStorePurchaseProcessingIdempotencyKey({
        decodedTransaction: decoded({
          purchaseDate: Option.some(PURCHASE_DATE),
          signedDate: Option.some(PURCHASE_DATE + 1_000),
          transactionId: Option.some("tx_refund_reversed"),
        }),
        eventType: "refund_reversed",
      });
      const fromReconciliation = yield* getAppStorePurchaseProcessingIdempotencyKey({
        decodedTransaction: decoded({
          purchaseDate: Option.some(PURCHASE_DATE),
          signedDate: Option.some(PURCHASE_DATE + 86_400_000),
          transactionId: Option.some("tx_refund_reversed"),
        }),
        eventType: "refund_reversed",
      });
      expect(fromWebhook).toBe(fromReconciliation);
      expect(fromWebhook).toBe(`apple:tx_refund_reversed:refund_reversed:${PURCHASE_DATE}`);
    }),
  );

  it.effect("derives renewal preference keys from renewalDate and target product", () =>
    Effect.gen(function* () {
      const key = yield* getAppStorePurchaseProcessingIdempotencyKey({
        decodedRenewalInfo: Option.some(
          renewalInfo({
            autoRenewProductId: Option.some("product_next"),
            renewalDate: Option.some(RENEWAL_DATE),
          }),
        ),
        decodedTransaction: decoded({
          originalTransactionId: Option.some("original_tx"),
          productId: Option.some("product_current"),
          signedDate: Option.some(PURCHASE_DATE + 1_000),
        }),
        eventType: "renewal_pref_change",
      });
      expect(key).toBe(`apple:original_tx:renewal_pref_change:${RENEWAL_DATE}:product_next`);
    }),
  );

  it.effect("keeps offer redeemed keys stable across Apple re-signs", () =>
    Effect.gen(function* () {
      const first = yield* getAppStorePurchaseProcessingIdempotencyKey({
        decodedTransaction: decoded({
          offerIdentifier: Option.some("offer_spring"),
          purchaseDate: Option.some(PURCHASE_DATE),
          signedDate: Option.some(PURCHASE_DATE + 1_000),
          transactionId: Option.some("tx_offer"),
        }),
        eventType: "offer_redeemed",
      });
      const second = yield* getAppStorePurchaseProcessingIdempotencyKey({
        decodedTransaction: decoded({
          offerIdentifier: Option.some("offer_spring"),
          purchaseDate: Option.some(PURCHASE_DATE),
          signedDate: Option.some(PURCHASE_DATE + 86_400_000),
          transactionId: Option.some("tx_offer"),
        }),
        eventType: "offer_redeemed",
      });
      expect(first).toBe(second);
      expect(first).toBe(`apple:tx_offer:offer_redeemed:${PURCHASE_DATE}:offer_spring`);
    }),
  );

  it.effect("derives price increase keys from renewal info when present", () =>
    Effect.gen(function* () {
      const key = yield* getAppStorePurchaseProcessingIdempotencyKey({
        decodedRenewalInfo: Option.some(
          renewalInfo({
            currency: Option.some("USD"),
            renewalDate: Option.some(RENEWAL_DATE),
            renewalPrice: Option.some(12_990),
          }),
        ),
        decodedTransaction: decoded({
          expiresDate: Option.some(EXPIRES_DATE),
          originalTransactionId: Option.some("original_tx"),
          price: Option.some(9_990),
          signedDate: Option.some(PURCHASE_DATE + 1_000),
        }),
        eventType: "price_increase",
      });
      expect(key).toBe(`apple:original_tx:price_increase:${RENEWAL_DATE}:12990:USD`);
    }),
  );

  it.effect("falls back to transaction price data when renewal price is absent", () =>
    Effect.gen(function* () {
      const key = yield* getAppStorePurchaseProcessingIdempotencyKey({
        decodedRenewalInfo: Option.some(
          renewalInfo({
            renewalDate: Option.some(RENEWAL_DATE),
          }),
        ),
        decodedTransaction: decoded({
          currency: Option.some("EUR"),
          expiresDate: Option.some(EXPIRES_DATE),
          originalTransactionId: Option.some("original_tx"),
          price: Option.some(9_990),
        }),
        eventType: "price_increase",
      });
      expect(key).toBe(`apple:original_tx:price_increase:${RENEWAL_DATE}:9990:EUR`);
    }),
  );

  it.effect("keeps auto-renew resume keys stable across Apple re-signs", () =>
    Effect.gen(function* () {
      const first = yield* getAppStorePurchaseProcessingIdempotencyKey({
        decodedTransaction: decoded({
          expiresDate: Option.some(EXPIRES_DATE),
          originalTransactionId: Option.some("original_tx"),
          signedDate: Option.some(PURCHASE_DATE + 1_000),
        }),
        eventType: "auto_renew_resumed",
      });
      const second = yield* getAppStorePurchaseProcessingIdempotencyKey({
        decodedTransaction: decoded({
          expiresDate: Option.some(EXPIRES_DATE),
          originalTransactionId: Option.some("original_tx"),
          signedDate: Option.some(PURCHASE_DATE + 86_400_000),
        }),
        eventType: "auto_renew_resumed",
      });
      expect(first).toBe(second);
      expect(first).toBe(`apple:original_tx:auto_renew_resumed:${EXPIRES_DATE}`);
    }),
  );

  it.effect("derives a revoke key distinct from a refund key with the same anchors", () =>
    Effect.gen(function* () {
      const refundKey = yield* getAppStorePurchaseProcessingIdempotencyKey({
        decodedTransaction: decoded({
          revocationDate: Option.some(REVOCATION_DATE),
          transactionId: Option.some("tx_shared"),
        }),
        eventType: "refund",
      });
      const revokeKey = yield* getAppStorePurchaseProcessingIdempotencyKey({
        decodedTransaction: decoded({
          revocationDate: Option.some(REVOCATION_DATE),
          transactionId: Option.some("tx_shared"),
        }),
        eventType: "revoke",
      });
      expect(refundKey).not.toBe(revokeKey);
    }),
  );

  it.effect("fails when transactionId is missing for a purchase event", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        getAppStorePurchaseProcessingIdempotencyKey({
          decodedTransaction: decoded({ purchaseDate: Option.some(PURCHASE_DATE) }),
          eventType: "purchase",
        }),
      );
      expect(error).toBeInstanceOf(AppStorePurchaseProcessingIdempotencyKeyDerivationError);
      expect(error.missingField).toBe("transactionId");
      expect(error.eventType).toBe("purchase");
    }),
  );

  it.effect("fails when purchaseDate is missing for a purchase event", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        getAppStorePurchaseProcessingIdempotencyKey({
          decodedTransaction: decoded({ transactionId: Option.some("tx_no_date") }),
          eventType: "purchase",
        }),
      );
      expect(error).toBeInstanceOf(AppStorePurchaseProcessingIdempotencyKeyDerivationError);
      expect(error.missingField).toBe("purchaseDate");
      expect(error.providerTransactionId).toBe("tx_no_date");
    }),
  );

  it.effect("fails when originalTransactionId is missing for an expired event", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        getAppStorePurchaseProcessingIdempotencyKey({
          decodedTransaction: decoded({ expiresDate: Option.some(EXPIRES_DATE) }),
          eventType: "expired",
        }),
      );
      expect(error.missingField).toBe("originalTransactionId");
    }),
  );

  it.effect("fails when revocationDate is missing for a refund event", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        getAppStorePurchaseProcessingIdempotencyKey({
          decodedTransaction: decoded({ transactionId: Option.some("tx_no_revocation") }),
          eventType: "refund",
        }),
      );
      expect(error.missingField).toBe("revocationDate");
    }),
  );
});

describe("classifyAppStoreRevocation", () => {
  it("classifies a FAMILY_REVOKE-tagged transaction as family_revoke", () => {
    expect(
      classifyAppStoreRevocation(
        decoded({
          inAppOwnershipType: Option.some(InAppOwnershipType.PURCHASED),
          revocationType: Option.some(RevocationType.FAMILY_REVOKE),
        }),
      ),
    ).toBe("family_revoke");
  });

  it("classifies a REFUND_FULL-tagged transaction as refund", () => {
    expect(
      classifyAppStoreRevocation(
        decoded({ revocationType: Option.some(RevocationType.REFUND_FULL) }),
      ),
    ).toBe("refund");
  });

  it("classifies a REFUND_PRORATED-tagged transaction as refund", () => {
    expect(
      classifyAppStoreRevocation(
        decoded({ revocationType: Option.some(RevocationType.REFUND_PRORATED) }),
      ),
    ).toBe("refund");
  });

  it("falls back to FAMILY_SHARED ownership when revocationType is absent", () => {
    expect(
      classifyAppStoreRevocation(
        decoded({ inAppOwnershipType: Option.some(InAppOwnershipType.FAMILY_SHARED) }),
      ),
    ).toBe("family_revoke");
  });

  it("falls back to PURCHASED ownership as refund when revocationType is absent", () => {
    expect(
      classifyAppStoreRevocation(
        decoded({ inAppOwnershipType: Option.some(InAppOwnershipType.PURCHASED) }),
      ),
    ).toBe("refund");
  });

  it("defaults to refund when both revocationType and inAppOwnershipType are absent", () => {
    expect(classifyAppStoreRevocation(decoded())).toBe("refund");
  });
});

describe("getAppStorePersonIdentifier", () => {
  it("prefers appAccountToken when present", () => {
    expect(
      getAppStorePersonIdentifier(
        decoded({
          appAccountToken: Option.some("token_uuid"),
          originalTransactionId: Option.some("original_tx"),
          transactionId: Option.some("tx_decoded"),
        }),
      ),
    ).toEqual(Option.some("token_uuid"));
  });

  it("falls back to originalTransactionId for parallel migrations", () => {
    expect(
      getAppStorePersonIdentifier(
        decoded({
          originalTransactionId: Option.some("original_tx"),
          transactionId: Option.some("tx_decoded"),
        }),
      ),
    ).toEqual(Option.some("original_tx"));
  });

  it("falls back to transactionId when nothing else is available", () => {
    expect(
      getAppStorePersonIdentifier(decoded({ transactionId: Option.some("tx_decoded") })),
    ).toEqual(Option.some("tx_decoded"));
  });

  it("returns Option.none for a degenerate payload with no identifiers", () => {
    expect(getAppStorePersonIdentifier(decoded())).toEqual(Option.none());
  });
});
