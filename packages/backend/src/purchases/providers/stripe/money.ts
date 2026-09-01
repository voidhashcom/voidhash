/**
 * Provider-specific money normalization for Stripe.
 *
 * Unlike Apple (single tax-inclusive `price` in milliunits, commission derived
 * from program rules), Stripe reports amounts directly in the currency's minor
 * unit and exposes the processing fee on the charge's `balance_transaction`.
 * So the five-amount breakdown is assembled straight from the event + the
 * fetched fee:
 *
 *   gross   = amount paid                      (minor units, as Stripe reports)
 *   tax     = invoice / checkout tax lines     (0 when unknown)
 *   comm.   = Stripe processing fee            (balance_transaction.fee; 0 when unfetched)
 *   proc.   = gross - comm.
 *   procT.  = gross - comm. - tax
 *
 * FX→USD conversion reuses the same `FxRateService` and 6-dp encoded rate as
 * the App Store path. Returns `Option.none()` when gross currency is missing /
 * invalid so downstream layers leave money fields blank rather than emit zeros.
 */
import { parseISO4217CurrencyCode } from "@voidhash/lib/constants";
import type { DbError } from "@voidhash/db";
import { pick } from "@voidhash/lib/lang";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { PurchaseProcessingMoney, PurchaseProcessingMoneyUsd } from "@voidhash/core-v2";
import {
  CurrencyCode,
  ExchangeRate,
  FX_RATE_PRECISION,
  MinorAmount,
  type FxRateLookup,
  type FxRateServiceError,
} from "@voidhash/core-v2";
import * as Schema from "effect/Schema";

const convertToUsd = (amount: number, rate: number): number =>
  Math.round((amount * rate) / FX_RATE_PRECISION);

const buildUsdBreakdown = (
  amounts: {
    readonly grossAmount: number;
    readonly storeCommissionAmount: number;
    readonly taxAmount: number;
    readonly proceedsAmount: number;
    readonly proceedsAfterTaxAmount: number;
  },
  exchangeRate: number,
): PurchaseProcessingMoneyUsd =>
  new PurchaseProcessingMoneyUsd({
    exchangeRate: ExchangeRate.make(exchangeRate),
    grossAmount: MinorAmount.make(convertToUsd(amounts.grossAmount, exchangeRate)),
    proceedsAfterTaxAmount: MinorAmount.make(
      convertToUsd(amounts.proceedsAfterTaxAmount, exchangeRate),
    ),
    proceedsAmount: MinorAmount.make(convertToUsd(amounts.proceedsAmount, exchangeRate)),
    storeCommissionAmount: MinorAmount.make(
      convertToUsd(amounts.storeCommissionAmount, exchangeRate),
    ),
    taxAmount: MinorAmount.make(convertToUsd(amounts.taxAmount, exchangeRate)),
  });

/**
 * Structural subset of `FxRateService` used here — the resolved instance is
 * captured at engine construction and passed in, so the FX requirement never
 * propagates into each `record*` method's `R` channel. Mirrors the App Store
 * `FxRateLookupShape`.
 */
export interface FxRateLookupShape {
  readonly getUsdRate: (input: {
    readonly currency: string;
    readonly asOf: Date;
  }) => Effect.Effect<Option.Option<FxRateLookup>, FxRateServiceError | DbError>;
}

const nonNegative = (n: number): number => {
  if (n > 0) return Math.round(n);
  return 0;
};

/**
 * Builds the platform-neutral money record for a Stripe money-bearing event.
 *
 * `feeMinor` is the fetched Stripe processing fee (store commission); pass
 * `undefined` when it could not be fetched — proceeds then equal gross minus
 * tax (fee unknown, never guessed). `storefront` is intentionally not populated
 * from Stripe (it reports ISO-3166 alpha-2, which would clash with Apple's
 * alpha-3 in the same analytics column) and is left absent for now.
 */
export const buildStripeMoney = (input: {
  readonly grossMinor: number;
  readonly currency: string;
  readonly taxMinor: number;
  readonly feeMinor: number | typeof Schema.Undefined.Type;
  readonly occurredAt: Date;
  readonly fxRateService: FxRateLookupShape;
}) =>
  Effect.gen(function* () {
    const currencyOp = yield* parseISO4217CurrencyCode(input.currency.toUpperCase()).pipe(
      Effect.map(Option.some),
      Effect.catchTag("InvalidISO4217CurrencyCodeError", () =>
        Effect.succeed(Option.none<string>()),
      ),
    );
    if (Option.isNone(currencyOp)) {
      return Option.none<PurchaseProcessingMoney>();
    }
    const currency = currencyOp.value;

    const grossAmount = nonNegative(input.grossMinor);
    const taxAmount = nonNegative(input.taxMinor);
    const storeCommissionAmount = pick(
      input.feeMinor === undefined,
      0,
      Math.min(nonNegative(input.feeMinor ?? 0), grossAmount),
    );
    const proceedsAmount = nonNegative(grossAmount - storeCommissionAmount);
    const proceedsAfterTaxAmount = nonNegative(proceedsAmount - taxAmount);

    const fxLookup = yield* input.fxRateService.getUsdRate({ asOf: input.occurredAt, currency });
    const usd = Option.map(fxLookup, (lookup) =>
      buildUsdBreakdown(
        { grossAmount, proceedsAfterTaxAmount, proceedsAmount, storeCommissionAmount, taxAmount },
        lookup.rate,
      ),
    );

    return Option.some(
      new PurchaseProcessingMoney({
        currency: CurrencyCode.make(currency),
        grossAmount: MinorAmount.make(grossAmount),
        proceedsAfterTaxAmount: MinorAmount.make(proceedsAfterTaxAmount),
        proceedsAmount: MinorAmount.make(proceedsAmount),
        storeCommissionAmount: MinorAmount.make(storeCommissionAmount),
        storefront: Option.none(),
        taxAmount: MinorAmount.make(taxAmount),
        usd,
      }),
    );
  });
