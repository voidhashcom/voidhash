import React, { useCallback, useMemo } from "react";

import type { VoidhashClient } from "../../client";
import type { SubscriptionProduct } from "../../core/entities/product";
import type { ProductSlug } from "../../core/schema/registry";
import type { VoidhashContext } from "../components/provider";
import useAsyncFunction from "./use-async-function";

export function productsHookFactory(
  client: VoidhashClient,
  vhContext: React.Context<VoidhashContext | null>,
) {
  function useProducts() {
    const voidhashContext = React.useContext(vhContext);

    const getProductsCallback = useCallback(() => client.getProducts(), []);

    const {
      data: products,
      isLoading,
      error,
    } = useAsyncFunction(getProductsCallback, {
      enabled: voidhashContext?.isInitialized,
    });

    const getProduct = useCallback(
      (productSlug: ProductSlug): SubscriptionProduct | null => {
        if (!products) {
          return null;
        }
        // ProductSlug is `string` at runtime; the index access is safe.
        return (
          (products as Record<string, SubscriptionProduct | null>)[String(productSlug)] ?? null
        );
      },
      [products],
    );

    const toList = useCallback(
      (): SubscriptionProduct[] =>
        products
          ? (Object.values(products) as Array<SubscriptionProduct | null>).filter(
              (product): product is SubscriptionProduct => product !== null,
            )
          : [],
      [products],
    );

    const data = useMemo(
      () => ({
        ...(products ?? {}),
        get: getProduct,
        toList,
      }),
      [products, getProduct, toList],
    );

    return {
      data: data as Record<ProductSlug, SubscriptionProduct | null> & {
        get: typeof getProduct;
        toList: typeof toList;
      },
      error,
      isLoading,
    };
  }
  return useProducts;
}
