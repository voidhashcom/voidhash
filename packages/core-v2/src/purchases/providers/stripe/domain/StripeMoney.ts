/**
 * Provider-specific money normalization for Stripe.
 *
 * Stripe reports amounts directly in the currency's minor unit and exposes
 * the processing fee on the charge's `balance_transaction`, so the
 * five-amount breakdown is assembled straight from the event and the fee:
 *
 *   gross   = amount paid                      (minor units, as Stripe reports)
 *   tax     = invoice / checkout tax lines     (0 when unknown)
 *   comm.   = Stripe processing fee            (balance_transaction.fee; 0 when unfetched)
 *   proc.   = gross - comm.
 *   procT.  = gross - comm. - tax
 *
 * Returns `Option.none()` when the currency is missing or invalid so
 * downstream layers leave money fields blank rather than emit zeros.
 */
import { pick } from "@voidhash/lib/lang";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import type * as Schema from "effect/Schema";

import { CurrencyCode, MinorAmount } from "../../../domain/Money.ts";
import { PurchaseProcessingMoney } from "../../../domain/PurchaseProcessing.ts";
import {
  buildUsdBreakdown,
  parseProviderCurrency,
  type FxRateLookupShape,
} from "../../domain/ProviderMoney.ts";

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
 * alpha-3 in the same analytics column) and is left absent.
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
    const currencyOp = yield* parseProviderCurrency(input.currency.toUpperCase());
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
