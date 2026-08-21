import { Result } from "better-result";
import { useCallback, useState } from "react";

import type { PurchaseOutcome, VoidhashClient } from "../../client";
import type { Product } from "../../core/entities/product";
import type { VoidhashError } from "../../errors";

export type PurchaseResult = Result<PurchaseOutcome, VoidhashError>;

export interface UsePurchaseOptions {
  onSuccess?: () => void;
  onError?: (error: VoidhashError) => void;
  onSettled?: (result: PurchaseResult) => void;
}

export type UsePurchaseCallOptions = UsePurchaseOptions;

export function purchaseHookFactory(client: VoidhashClient) {
  function usePurchase(hookOptions?: UsePurchaseOptions) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<VoidhashError | null>(null);

    const purchase = useCallback(
      (product: Product, options?: UsePurchaseCallOptions): Promise<PurchaseResult> => {
        setIsLoading(true);
        setError(null);

        // Call-level callbacks take precedence; the hook-level callback for
        // an event fires only when the call didn't provide its own.
        const onSuccess = options?.onSuccess ?? hookOptions?.onSuccess;
        const onError = options?.onError ?? hookOptions?.onError;
        const onSettled = options?.onSettled ?? hookOptions?.onSettled;

        // `purchase` never rejects — every outcome is a Result.
        return client.purchase(product).then((result) => {
          if (result.isOk()) {
            if (result.value.status === "completed") {
              onSuccess?.();
            }
          } else {
            setError(result.error);
            onError?.(result.error);
          }

          setIsLoading(false);
          onSettled?.(result);
          return result;
        });
      },
      [hookOptions],
    );

    return {
      error,
      isLoading,
      purchase,
    };
  }
  return usePurchase;
}
