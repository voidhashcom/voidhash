import * as R from "effect/Record";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import * as Option from "effect/Option";

import { CacheManager } from "../caching/cache-manager";
import type { Product } from "../entities/product";
import { PaymentAdapter } from "../payment-adapters/payment-adapter";
import type { ProductSlug } from "../schema/registry";
import type { RuntimeProductDefinition, RuntimeSchema } from "../schema/runtime";
import * as Schema from "effect/Schema";
const effectEncodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);

/**
 * Map of product slugs to the resolved native subscription product (or `None`
 * when the underlying store SDK doesn't know about that product on this
 * platform).
 */
export type ProductsBySlug = Readonly<Record<ProductSlug, Option.Option<Product>>>;

const NATIVE_PRODUCTS_CACHE_TTL_MS = 1000 * 60 * 60 * 24;

const generateCacheKeyFromProductDefinitions = (
  productDefinitions: Readonly<Record<string, RuntimeProductDefinition>>,
) => `native-products:${effectEncodeJson(productDefinitions)}`;

const mapNativeProductsToProductMap = (
  productDefinitions: Readonly<Record<string, RuntimeProductDefinition>>,
  nativeProducts: Product[],
): ProductsBySlug => {
  return R.map(productDefinitions, (_definition, slug) =>
    Option.fromNullishOr(nativeProducts.find((candidate) => candidate.slug === slug)),
  );
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

      const loadProductsCached = Effect.fn("ProductService.loadProductsCached")(function* (
        productDefinitions: Readonly<Record<string, RuntimeProductDefinition>>,
      ) {
        const cacheKey = generateCacheKeyFromProductDefinitions(productDefinitions);
        const cached = yield* cacheManager.get<Product[]>(cacheKey);
        if (Option.isSome(cached) && !(cached.value.isStale || cached.value.isExpired)) {
          yield* Effect.logDebug("Products fetched from cache", {
            products: cached.value.value,
          });
          return cached.value.value;
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

      const getProducts = Effect.fn("ProductService.getProducts")(function* (
        schema: RuntimeSchema,
      ) {
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
