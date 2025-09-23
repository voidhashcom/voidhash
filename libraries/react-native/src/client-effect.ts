import { Effect } from 'effect';
import { CacheManager } from './core/caching/cache-manager';
import type { Product } from './core/entities/product';
import { CustomerAttributeManager } from './core/identity/customer-attribute-manager';
import { CustomerInfoManager } from './core/identity/customer-info-manager';
import { IdentityManager } from './core/identity/identity-manager';
import { PaymentAdapter } from './core/payment-adapters/payment-adapter';
import type {
  ExtractSchemaProductDefinitions,
  ExtractSchemaProductKeys,
  InferGetProductResponseFromSchema,
  VoidhashSchema
} from './core/schema';
import { extractProductDefinitions } from './core/schema/utils';
import { UnsupportedPlatformError } from './errors';

const makeUnitializedClient = () => {
  return {
    init: <TSchema extends VoidhashSchema>(initOptions: {
      initialAppUserId?: string;
      schema: TSchema;
    }) =>
      Effect.gen(function* () {
        const identityManager = yield* IdentityManager;
        const customerAttributeManager = yield* CustomerAttributeManager;
        const customerInfoManager = yield* CustomerInfoManager;

        if (initOptions.initialAppUserId) {
          // Identify as the user which ID was passed during SDK initialization
          yield* Effect.logDebug('Initializing with initial user id', {
            appUserId: initOptions.initialAppUserId
          });

          // Sync customer attributes before identify to not lose historical customer data
          const appUserId = yield* identityManager.getAppUserIdFromCache();
          if (appUserId) {
            yield* customerAttributeManager.syncCustomerAttributes(appUserId);
          }

          yield* identityManager.identify(initOptions.initialAppUserId, {});
        } else {
          // If no user ID was passed during SDK initialization, fetch the last identified customer from the server
          const appUserId = yield* identityManager.getAppUserId();
          yield* Effect.logDebug('Initializing without initial user id', {
            appUserId
          });

          yield* customerAttributeManager.syncCustomerAttributes(appUserId);

          // We don't need the result immediately. We do this to pre-fetch fresh customer data in the background.
          yield* customerInfoManager.getCustomer(appUserId, 'fetch');
        }

        // Return the initialized client
        return makeInitializedClient<TSchema>({
          schema: initOptions.schema
        });
      })
  } as const;
};

const makeInitializedClient = <TSchema extends VoidhashSchema>(options: {
  schema: TSchema;
}) => {
  return {
    end: () =>
      Effect.gen(function* () {
        const paymentAdapter = yield* PaymentAdapter;
        return yield* paymentAdapter.endConnection();
      }),

    getCurrentCustomer: (forceFetch = false) =>
      Effect.gen(function* () {
        const identityManager = yield* IdentityManager;
        const customerInfoManager = yield* CustomerInfoManager;

        const appUserId = yield* identityManager.getAppUserId();
        const customer = yield* customerInfoManager.getCustomer(
          appUserId,
          forceFetch ? 'fetch' : 'fetch-while-stale'
        );

        return customer;
      }),

    identify: (
      appUserId: string,
      options: {
        email?: string;
        name?: string;
      }
    ) =>
      Effect.gen(function* () {
        const identityManager = yield* IdentityManager;
        return yield* identityManager.identify(appUserId, options);
      }),

    signOut: () =>
      Effect.gen(function* () {
        const identityManager = yield* IdentityManager;
        return yield* identityManager.signOut();
      }),

    getProducts: () =>
      Effect.gen(function* () {
        const productDefinitions = extractProductDefinitions(options.schema);
        const nativeProducts = yield* loadProductsCached(productDefinitions);
        return mapNativeProductsToProductMap(
          productDefinitions,
          nativeProducts
        );
      }),

    purchase: <TSchemaOverload extends VoidhashSchema>(
      product: NonNullable<
        InferGetProductResponseFromSchema<TSchemaOverload>[keyof InferGetProductResponseFromSchema<TSchemaOverload>]
      >,
      _options: {
        method?: 'native';
      }
    ) =>
      Effect.gen(function* () {
        const paymentAdapter = yield* PaymentAdapter;
        const transaction = yield* paymentAdapter.buyProduct(product);
        // TODO: Send transaction to backend
        yield* Effect.logDebug('Transaction bought', {
          transaction
        });

        return;
      }),

    iosPresentCodeRedemptionSheet: () =>
      Effect.gen(function* () {
        const paymentAdapter = yield* PaymentAdapter;
        const presentCodeRedemptionSheet =
          paymentAdapter.presentCodeRedemptionSheet;
        if (!presentCodeRedemptionSheet) {
          return yield* Effect.fail(
            new UnsupportedPlatformError(
              'Present code redemption sheet is not supported on this platform'
            )
          );
        }
        return yield* presentCodeRedemptionSheet();
      }),

    iosShowManageSubscriptions: () =>
      Effect.gen(function* () {
        const paymentAdapter = yield* PaymentAdapter;
        const showManageSubscriptions = paymentAdapter.showManageSubscriptions;
        if (!showManageSubscriptions) {
          return yield* Effect.fail(
            new UnsupportedPlatformError(
              'Show manage subscriptions is not supported on this platform'
            )
          );
        }
        return yield* showManageSubscriptions();
      })
  } as const;
};

const loadProductsCached = <TSchema extends VoidhashSchema>(
  productDefinitions: ExtractSchemaProductDefinitions<TSchema>
) =>
  Effect.gen(function* () {
    const cacheManager = yield* CacheManager;
    const paymentAdapter = yield* PaymentAdapter;

    const cacheKey = generateCacheKeyFromProductDefinitions(productDefinitions);

    const cachedProducts = yield* cacheManager.get<Product[]>(cacheKey);

    if (
      cachedProducts &&
      !(cachedProducts.isStale || cachedProducts.isExpired)
    ) {
      yield* Effect.logDebug('Products fetched from cache', {
        products: cachedProducts.value
      });
      return cachedProducts.value;
    }

    const nativeProducts =
      yield* paymentAdapter.getProducts(productDefinitions);

    yield* Effect.logDebug('Products fetched from native adapter', {
      products: nativeProducts
    });

    // Store products in cache
    yield* cacheManager.set(cacheKey, nativeProducts, {
      ttl: 1000 * 60 * 60 * 24 // 24 hours
    });

    return nativeProducts;
  });

const mapNativeProductsToProductMap = <TSchema extends VoidhashSchema>(
  productDefinitions: ExtractSchemaProductDefinitions<TSchema>,
  nativeProducts: Product[]
) => {
  const productMap: InferGetProductResponseFromSchema<TSchema> =
    {} as InferGetProductResponseFromSchema<TSchema>;

  for (const productDefinitionKey of Object.keys(productDefinitions)) {
    const productDefinition =
      productDefinitions[
        productDefinitionKey as ExtractSchemaProductKeys<TSchema>
      ];
    const nativeProduct = nativeProducts.find(
      (nativeProduct) => nativeProduct.slug === productDefinition.slug
    );

    if (nativeProduct) {
      productMap[productDefinitionKey as ExtractSchemaProductKeys<TSchema>] =
        nativeProduct as InferGetProductResponseFromSchema<TSchema>[ExtractSchemaProductKeys<TSchema>];
    }
  }

  return productMap;
};

const generateCacheKeyFromProductDefinitions = <TSchema extends VoidhashSchema>(
  productDefinitions: ExtractSchemaProductDefinitions<TSchema>
) => {
  return `native-products:${JSON.stringify(productDefinitions)}`;
};

export const VoidhashEffectClient = {
  makeUnitializedClient,
  makeInitializedClient
} as const;
