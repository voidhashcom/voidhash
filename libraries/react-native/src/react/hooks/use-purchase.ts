import { useCallback, useState } from "react";

import type { VoidhashClient } from "../../client";
import type {
  InferGetProductResponseFromSchema,
  VoidhashSchema,
} from "../../core/schema";

export interface UsePurchaseOptions {
  method?: "native";
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  onSettled?: () => void;
}

export function purchaseHookFactory<TSchema extends VoidhashSchema>(
  client: VoidhashClient<TSchema>
) {
  function usePurchase(hookOptions?: UsePurchaseOptions) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const purchase = useCallback(
      (
        product: Exclude<
          InferGetProductResponseFromSchema<TSchema>[keyof InferGetProductResponseFromSchema<TSchema>],
          null
        >,
        options?: {
          method?: "native";
          onSuccess?: () => void;
          onError?: (error: Error) => void;
          onSettled?: () => void;
        }
      ) => {
        setIsLoading(true);
        setError(null);

        const methodToUse = options?.method ?? hookOptions?.method;

        client
          .purchase(product, {
            method: methodToUse,
          })
          .then(() => {
            options?.onSuccess?.();
            hookOptions?.onSuccess?.();
          })
          .catch((error) => {
            setError(error);
            options?.onError?.(error);
            hookOptions?.onError?.(error);
          })
          .finally(() => {
            setIsLoading(false);
            options?.onSettled?.();
            hookOptions?.onSettled?.();
          });
      },
      [hookOptions]
    );

    return {
      error,
      isLoading,
      purchase,
    };
  }
  return usePurchase;
}
