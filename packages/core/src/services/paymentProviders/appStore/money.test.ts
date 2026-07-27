import {
  InAppOwnershipType,
  type JWSTransactionDecodedPayload,
  Type as AppleTransactionType,
} from "@voidhash/app-store-server-sdk";
import { Effect, Option } from "effect";

import { describe, expect, it } from "../../../testing/effect-vitest.ts";
import {
  type FxRateLookupShape,
  buildAppStoreMoney,
  estimateAppleTaxAmount,
  resolveAppleCommissionRateBps,
} from "./money.ts";

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

const sbpEnabled = {
  appleSmallBusinessProgramEndDate: undefined,
  appleSmallBusinessProgramHasEndDate: false,
  appleSmallBusinessProgramStartDate: "2025-01-01",
};

const sbpDisabled = {
  appleSmallBusinessProgramEndDate: undefined,
  appleSmallBusinessProgramHasEndDate: false,
  appleSmallBusinessProgramStartDate: undefined,
};

const stubFxAt = (rate: number): FxRateLookupShape => ({
  getUsdRate: (input) =>
    Effect.succeed(
      Option.some({
        asOfDate: input.asOf,
        currency: input.currency,
        rate,
        source: "test",
      }),
    ),
});

const fxNone: FxRateLookupShape = {
  getUsdRate: () => Effect.succeed(Option.none()),
};

describe("resolveAppleCommissionRateBps", () => {
  it("returns 30% standard when neither SBP nor year-2 rule applies", () => {
    const rate = resolveAppleCommissionRateBps({
      decoded: decoded({
        originalPurchaseDate: Option.some(Date.UTC(2025, 11, 1)),
        purchaseDate: Option.some(Date.UTC(2026, 0, 1)),
        type: Option.some(AppleTransactionType.AUTO_RENEWABLE_SUBSCRIPTION),
      }),
      globalConfiguration: sbpDisabled,
      occurredAt: new Date("2026-01-01"),
    });
    expect(rate).toBe(3_000);
  });

  it("returns 15% when SBP is active at the transaction date", () => {
    const rate = resolveAppleCommissionRateBps({
      decoded: decoded({
        type: Option.some(AppleTransactionType.NON_CONSUMABLE),
      }),
      globalConfiguration: sbpEnabled,
      occurredAt: new Date("2026-01-01"),
    });
    expect(rate).toBe(1_500);
  });

  it("returns 15% for an auto-renewable subscription past its first year", () => {
    const rate = resolveAppleCommissionRateBps({
      decoded: decoded({
        originalPurchaseDate: Option.some(Date.UTC(2024, 5, 1)),
        purchaseDate: Option.some(Date.UTC(2026, 0, 1)),
        type: Option.some(AppleTransactionType.AUTO_RENEWABLE_SUBSCRIPTION),
      }),
      globalConfiguration: sbpDisabled,
      occurredAt: new Date("2026-01-01"),
    });
    expect(rate).toBe(1_500);
  });

  it("ignores the year-2 rule for non-subscription product types", () => {
    const rate = resolveAppleCommissionRateBps({
      decoded: decoded({
        originalPurchaseDate: Option.some(Date.UTC(2024, 5, 1)),
        purchaseDate: Option.some(Date.UTC(2026, 0, 1)),
        type: Option.some(AppleTransactionType.CONSUMABLE),
      }),
      globalConfiguration: sbpDisabled,
      occurredAt: new Date("2026-01-01"),
    });
    expect(rate).toBe(3_000);
  });

  it("returns 30% when the transaction date precedes the SBP start date", () => {
    const rate = resolveAppleCommissionRateBps({
      decoded: decoded({}),
      globalConfiguration: sbpEnabled,
      occurredAt: new Date("2024-01-01"),
    });
    expect(rate).toBe(3_000);
  });
});

describe("estimateAppleTaxAmount", () => {
  it("returns 0 for US storefront (no VAT in JWS price)", () => {
    expect(
      estimateAppleTaxAmount({
        grossAmount: 9_99,
        storefront: Option.some("USA"),
      }),
    ).toBe(0);
  });

  it("returns 0 when the storefront is unknown", () => {
    expect(
      estimateAppleTaxAmount({
        grossAmount: 9_99,
        storefront: Option.some("ZZZ"),
      }),
    ).toBe(0);
  });

  it("returns 0 when the storefront is omitted", () => {
    expect(
      estimateAppleTaxAmount({
        grossAmount: 9_99,
        storefront: Option.none(),
      }),
    ).toBe(0);
  });

  it("backs out 19% VAT from a German storefront gross", () => {
    // gross of 1190 minor units with 19% VAT → tax = 1190 × 0.19 / 1.19 = 190.
    expect(
      estimateAppleTaxAmount({
        grossAmount: 1_190,
        storefront: Option.some("DEU"),
      }),
    ).toBe(190);
  });

  it("backs out 20% VAT from a UK storefront gross", () => {
    // gross of 1200 with 20% VAT → tax = 200.
    expect(
      estimateAppleTaxAmount({
        grossAmount: 1_200,
        storefront: Option.some("GBR"),
      }),
    ).toBe(200);
  });
});

describe("buildAppStoreMoney", () => {
  it("returns Option.none() when price is missing", async () => {
    const result = await Effect.runPromise(
      buildAppStoreMoney({
        decoded: decoded({ currency: Option.some("USD") }),
        fxRateService: stubFxAt(1_000_000),
        globalConfiguration: sbpDisabled,
        occurredAt: new Date("2026-01-01"),
      }),
    );
    expect(Option.isNone(result)).toBe(true);
  });

  it("returns Option.none() when currency is missing", async () => {
    const result = await Effect.runPromise(
      buildAppStoreMoney({
        decoded: decoded({ price: Option.some(9_990) }),
        fxRateService: stubFxAt(1_000_000),
        globalConfiguration: sbpDisabled,
        occurredAt: new Date("2026-01-01"),
      }),
    );
    expect(Option.isNone(result)).toBe(true);
  });

  it("returns Option.none() when the currency is not a valid ISO 4217 code", async () => {
    const result = await Effect.runPromise(
      buildAppStoreMoney({
        decoded: decoded({
          currency: Option.some("ZZ"),
          price: Option.some(9_990),
        }),
        fxRateService: stubFxAt(1_000_000),
        globalConfiguration: sbpDisabled,
        occurredAt: new Date("2026-01-01"),
      }),
    );
    expect(Option.isNone(result)).toBe(true);
  });

  it("computes gross/commission/proceeds and a USD mirror for a standard USD purchase", async () => {
    const result = await Effect.runPromise(
      buildAppStoreMoney({
        decoded: decoded({
          currency: Option.some("USD"),
          originalPurchaseDate: Option.some(Date.UTC(2025, 11, 1)),
          price: Option.some(9_990), // 999 cents in milliunits
          purchaseDate: Option.some(Date.UTC(2026, 0, 1)),
          storefront: Option.some("USA"),
          type: Option.some(AppleTransactionType.AUTO_RENEWABLE_SUBSCRIPTION),
        }),
        fxRateService: stubFxAt(1_000_000),
        globalConfiguration: sbpDisabled,
        occurredAt: new Date("2026-01-01"),
      }),
    );
    expect(Option.isSome(result)).toBe(true);
    const money = Option.getOrThrow(result);
    expect(money.currency).toBe("USD");
    expect(money.grossAmount).toBe(999);
    // 30% commission → 300
    expect(money.storeCommissionAmount).toBe(300);
    expect(money.taxAmount).toBe(0);
    expect(money.proceedsAmount).toBe(699);
    expect(money.proceedsAfterTaxAmount).toBe(699);
    const usd = Option.getOrThrow(money.usd);
    expect(usd.grossAmount).toBe(999);
    expect(usd.proceedsAmount).toBe(699);
  });

  it("scales every amount proportionally for a partial refund", async () => {
    const result = await Effect.runPromise(
      buildAppStoreMoney({
        decoded: decoded({
          currency: Option.some("USD"),
          price: Option.some(10_000), // 1000 cents in milliunits
          revocationPercentage: Option.some(50_000), // 50%
          storefront: Option.some("USA"),
        }),
        fxRateService: stubFxAt(1_000_000),
        globalConfiguration: sbpDisabled,
        occurredAt: new Date("2026-01-01"),
      }),
    );
    const money = Option.getOrThrow(result);
    expect(money.grossAmount).toBe(500);
    expect(money.storeCommissionAmount).toBe(150);
    expect(money.proceedsAmount).toBe(350);
  });

  it("zeroes commission for family-shared transactions but keeps gross", async () => {
    const result = await Effect.runPromise(
      buildAppStoreMoney({
        decoded: decoded({
          currency: Option.some("USD"),
          inAppOwnershipType: Option.some(InAppOwnershipType.FAMILY_SHARED),
          price: Option.some(9_990),
          storefront: Option.some("USA"),
          type: Option.some(AppleTransactionType.AUTO_RENEWABLE_SUBSCRIPTION),
        }),
        fxRateService: stubFxAt(1_000_000),
        globalConfiguration: sbpDisabled,
        occurredAt: new Date("2026-01-01"),
      }),
    );
    const money = Option.getOrThrow(result);
    expect(money.grossAmount).toBe(999);
    expect(money.storeCommissionAmount).toBe(0);
    expect(money.proceedsAmount).toBe(999);
  });

  it("leaves the USD mirror absent when the FX service has no rate", async () => {
    const result = await Effect.runPromise(
      buildAppStoreMoney({
        decoded: decoded({
          currency: Option.some("EUR"),
          price: Option.some(9_990),
          storefront: Option.some("DEU"),
        }),
        fxRateService: fxNone,
        globalConfiguration: sbpDisabled,
        occurredAt: new Date("2026-01-01"),
      }),
    );
    const money = Option.getOrThrow(result);
    expect(money.currency).toBe("EUR");
    expect(Option.isNone(money.usd)).toBe(true);
    // gross 999, German VAT 19%: 999 × 1900 / 11900 = 159.504 → 160 (rounded)
    expect(money.taxAmount).toBe(160);
  });
});
