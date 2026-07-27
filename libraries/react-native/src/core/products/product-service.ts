import { Effect, Layer, Context } from "effect";

import { CacheManager } from "../caching/cache-manager";
import type { Product } from "../entities/product";
import { PaymentAdapter } from "../payment-adapters/payment-adapter";
import type { ProductSlug } from "../schema/registry";
import type { RuntimeProductDefinition, RuntimeSchema } from "../schema/runtime";

/**
 * Map of product slugs to the resolved native subscription product (or `null`
 * when the underlying store SDK doesn't know about that product on this
 * platform).
 */
export type ProductsBySlug = Record<ProductSlug, Product | null>;

const NATIVE_PRODUCTS_CACHE_TTL_MS = 1000 * 60 * 60 * 24;

const generateCacheKeyFromProductDefinitions = (
  productDefinitions: Readonly<Record<string, RuntimeProductDefinition>>,
) => `native-products:${JSON.stringify(productDefinitions)}`;

const mapNativeProductsToProductMap = (
  productDefinitions: Readonly<Record<string, RuntimeProductDefinition>>,
  nativeProducts: Product[],
): ProductsBySlug => {
  const productMap = {} as Record<string, Product | null>;

  for (const slug of Object.keys(productDefinitions)) {
    const nativeProduct = nativeProducts.find((candidate) => candidate.slug === slug);
    productMap[slug] = nativeProduct ?? null;
  }

  return productMap as ProductsBySlug;
};

/**
 * Fetches the products declared in the given schema from the native store
 * (with a 24h cache) and maps them back to the schema slugs. Missing products
 * (not configured for the current platform) are returned as `null`.
 */
export class ProductService extends Context.Service<ProductService>()(
  "rn-voidhash/ProductService",
  {
    make: Effect.gen(function* () {
      const cacheManager = yield* CacheManager;
      const paymentAdapter = yield* PaymentAdapter;

      const loadProductsCached = (
        productDefinitions: Readonly<Record<string, RuntimeProductDefinition>>,
      ) =>
        Effect.gen(function* () {
          const cacheKey = generateCacheKeyFromProductDefinitions(productDefinitions);
          const cached = yield* cacheManager.get<Product[]>(cacheKey);
          if (cached && !(cached.isStale || cached.isExpired)) {
            yield* Effect.logDebug("Products fetched from cache", {
              products: cached.value,
            });
            return cached.value;
          }

          const nativeProducts = yield* paymentAdapter.getProducts(productDefinitions);
          yield* Effect.logDebug("Products fetched from native adapter", {
            products: nativeProducts,
          });

          yield* cacheManager.set(cacheKey, nativeProducts, {
            ttl: NATIVE_PRODUCTS_CACHE_TTL_MS,
          });

          return nativeProducts;
        });

      const getProducts = (schema: RuntimeSchema) =>
        Effect.gen(function* () {
          const productDefinitions = schema.products;
          const nativeProducts = yield* loadProductsCached(productDefinitions);
          return mapNativeProductsToProductMap(productDefinitions, nativeProducts);
        });

      return { getProducts } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
