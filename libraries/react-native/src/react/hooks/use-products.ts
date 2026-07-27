import React, { useCallback, useMemo } from "react";

import type { VoidhashClient } from "../../client";
import type { Product } from "../../core/entities/product";
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
      (productSlug: ProductSlug): Product | null => {
        if (!products) {
          return null;
        }
        // ProductSlug is `string` at runtime; the index access is safe.
        return (products as Record<string, Product | null>)[String(productSlug)] ?? null;
      },
      [products],
    );

    const toList = useCallback(
      (): Product[] =>
        products
          ? (Object.values(products) as Array<Product | null>).filter(
              (product): product is Product => product !== null,
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
      data: data as Record<ProductSlug, Product | null> & {
        get: typeof getProduct;
        toList: typeof toList;
      },
      error,
      isLoading,
    };
  }
  return useProducts;
}
