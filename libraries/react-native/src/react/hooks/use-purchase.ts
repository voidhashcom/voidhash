import { Result } from "better-result";
import * as Option from "effect/Option";
import * as React from "react";

import type { PurchaseOptions, PurchaseResult, VoidhashClient } from "../../client";
import type { Product } from "../../core/entities/product";
import { PurchaseInProgressError, type VoidhashError } from "../../errors";
import { type VoidhashContext, useProviderStatus } from "../components/provider";
import { runHostCallback } from "../internal/host-callback";

/** A purchase the store charged for, as `onSuccess` receives it. */
export type CompletedPurchase = Extract<PurchaseResult, { status: "purchased" }>;

/**
 * Callbacks for a purchase's outcome. An exception a callback throws (or a
 * promise it returns that rejects) is reported through `onDiagnostic` as
 * `HOST_CALLBACK_FAILED` and never affects the purchase or the hook's state.
 */
export interface UsePurchaseOptions {
  /**
   * Runs when the store charged (`purchased`), whether or not Voidhash has
   * accepted the receipt yet (`synced`): the purchase is done either way.
   */
  onSuccess?: (result: CompletedPurchase) => void;
  onError?: (error: VoidhashError) => void;
  onSettled?: (result: Result<PurchaseResult, VoidhashError>) => void;
}

/**
 * What one `purchase()` call of the hook takes: its own callbacks, and the
 * purchase options `client.purchase()` takes.
 */
export interface UsePurchaseCallOptions extends UsePurchaseOptions, PurchaseOptions {}

export function purchaseHookFactory(
  client: VoidhashClient,
  vhContext: React.Context<Option.Option<VoidhashContext>>,
) {
  /**
   * Buys products, for a Buy button. `purchase(product)` resolves with the
   * result of `client.purchase()` and never rejects; `pendingProduct` is the
   * product a purchase this hook started is buying. Pressing Buy again for
   * the same product with the same purchase options while it runs answers
   * that same purchase (its callbacks, not the second call's, run); a
   * purchase of another product, or of the same product with other options
   * (another offer, say), meanwhile resolves `Err(PURCHASE_IN_PROGRESS)` and
   * leaves the running one alone.
   */
  function usePurchase(hookOptions?: UsePurchaseOptions) {
    useProviderStatus(vhContext, "usePurchase");
    // oxlint-disable-next-line effect/prefer-option-over-null -- public hook answer consumed by non-Effect app code.
    const [pendingProduct, setPendingProduct] = React.useState<Product | undefined>(undefined);
    // oxlint-disable-next-line effect/prefer-option-over-null -- public hook answer consumed by non-Effect app code.
    const [error, setError] = React.useState<VoidhashError | null>(null);
    const running = React.useRef(
      Option.none<{
        /** What it buys; `None` for options `purchase()` refuses, which match nothing. */
        readonly key: Option.Option<string>;
        readonly settled: Promise<Result<PurchaseResult, VoidhashError>>;
      }>(),
    );

    const purchase = React.useCallback(
      (
        product: Product,
        options?: UsePurchaseCallOptions,
      ): Promise<Result<PurchaseResult, VoidhashError>> => {
        const { onError, onSettled, onSuccess, ...purchaseOptions } = {
          ...hookOptions,
          ...options,
        };
        const runCallbacks = (result: Result<PurchaseResult, VoidhashError>) => {
          if (result.isOk() && result.value.status === "purchased" && onSuccess) {
            const completed = result.value;
            runHostCallback(client, "usePurchase.onSuccess", () => onSuccess(completed));
          }
          if (result.isErr() && onError) {
            runHostCallback(client, "usePurchase.onError", () => onError(result.error));
          }
          if (onSettled) runHostCallback(client, "usePurchase.onSettled", () => onSettled(result));
        };

        const key = client.internal.purchaseKey(product, purchaseOptions);
        const current = running.current;
        if (Option.isSome(current)) {
          if (Option.isSome(key) && Option.contains(current.value.key, key.value)) {
            return current.value.settled;
          }
          const refused = Result.err<PurchaseResult, VoidhashError>(new PurchaseInProgressError());
          runCallbacks(refused);
          return Promise.resolve(refused);
        }

        setPendingProduct(product);
        setError(null);
        // `purchase` never rejects — every outcome is a Result — and the hook
        // settles before any callback runs, so a callback that throws cannot
        // leave it loading.
        const settled = client.purchase(product, purchaseOptions).then((result) => {
          running.current = Option.none();
          setPendingProduct(undefined);
          if (result.isErr()) setError(result.error);
          runCallbacks(result);
          return result;
        });
        running.current = Option.some({ key, settled });
        return settled;
      },
      [hookOptions],
    );

    return {
      /** The error of the last purchase this hook started, or `null`. */
      error,
      /** Whether a purchase this hook started is running. */
      isLoading: pendingProduct !== undefined,
      /** The product a purchase this hook started is buying, or `undefined`. */
      pendingProduct,
      purchase,
    };
  }
  return usePurchase;
}
