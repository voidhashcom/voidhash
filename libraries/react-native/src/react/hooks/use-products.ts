import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as R from "effect/Record";
import React from "react";

import type { VoidhashClient } from "../../client";
import type { Product } from "../../core/entities/product";
import type { ProductSlug } from "../../core/schema/registry";
import type { VoidhashContext } from "../components/provider";
import useAsyncFunction from "./use-async-function";

export function productsHookFactory(
  client: VoidhashClient,
  vhContext: React.Context<Option.Option<VoidhashContext>>,
) {
  function useProducts() {
    const voidhashContext = React.useContext(vhContext).valueOrUndefined;

    const getProductsCallback = React.useCallback(() => client.getProducts(), []);

    const {
      data: products,
      isLoading,
      error,
    } = useAsyncFunction(getProductsCallback, {
      enabled: voidhashContext?.isInitialized,
    });

    const getProduct = React.useCallback(
      (productSlug: ProductSlug): Option.Option<Product> => {
        if (!products) {
          return Option.none();
        }
        return products[String(productSlug)] ?? Option.none();
      },
      [products],
    );

    const toList = React.useCallback(
      (): Product[] =>
        products ? Arr.getSomes(R.values(products)) : [],
      [products],
    );

    const data = React.useMemo(
      () => ({
        bySlug: products ?? {},
        get: getProduct,
        toList,
      }),
      [products, getProduct, toList],
    );

    return {
      data,
      error,
      isLoading,
    };
  }
  return useProducts;
}
