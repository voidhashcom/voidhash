import React, { useCallback, useMemo } from "react";

import type { VoidhashClient } from "../../client";
import type { SubscriptionProduct } from "../../core/entities/product";
import type {
  ExtractSchemaProductDefinitions,
  InferGetProductResponseFromSchema,
  SubscriptionProductDefinition,
  VoidhashSchema,
} from "../../core/schema";
import type { VoidhashContext } from "../components/provider";
import useAsyncFunction from "./use-async-function";

export function productsHookFactory<TSchema extends VoidhashSchema>(
  client: VoidhashClient<TSchema>,
  vhContext: React.Context<VoidhashContext<TSchema> | null>
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
      (
        productDefinition: ExtractSchemaProductDefinitions<TSchema>[keyof ExtractSchemaProductDefinitions<TSchema>]
      ) => {
        if (!products) {
          return null;
        }

        const product = Object.values(products).find(
          (product) =>
            (product as SubscriptionProduct).slug ===
            // biome-ignore lint/suspicious/noExplicitAny: any is ok in this case
            (productDefinition as SubscriptionProductDefinition<any, any, any>)
              .slug
        ) as SubscriptionProduct | null;

        return product;
      },
      [products]
    );

    const toList = useCallback(
      () =>
        products
          ? (
              Object.values(products) as Exclude<
                Exclude<typeof products, null>[keyof typeof products],
                null
              >[]
            ).filter((product) => product !== null)
          : [],
      [products]
    );

    const data = useMemo(
      () => ({
        ...products,
        get: getProduct,
        toList,
      }),
      [products, getProduct, toList]
    );

    return {
      data: data as InferGetProductResponseFromSchema<TSchema> & {
        get: typeof getProduct;
        toList: typeof toList;
      },
      error,
      isLoading,
    };
  }
  return useProducts;
}
