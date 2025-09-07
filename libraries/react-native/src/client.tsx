import type { CacheManager } from './core/caching/cache-manager';
import type { Product } from './core/entities/product';
import type { EventBus } from './core/event-bus';
import type { CustomerAttributeManager } from './core/identity/customer-attribute-manager';
import type { CustomerInfoManager } from './core/identity/customer-info-manager';
import type { IdentityManager } from './core/identity/identity-manager';
import type { Logger } from './core/logging';
import type { HttpClient } from './core/networking/http-client';
import type { PaymentAdapter } from './core/payment-adapters/payment-adapter';
import type { PlatformProvider } from './core/platform/types';
import type {
  ExtractSchemaProductDefinitions,
  ExtractSchemaProductKeys,
  InferGetProductResponseFromSchema,
  VoidhashSchema
} from './core/schema';
import { extractProductDefinitions } from './core/schema/utils';
import {
  FailedToBuyProductError,
  NotInitializedError,
  ProductNotFoundError,
  PurchaseCancelledError,
  PurchasePendingError,
  UnknownVoidhashError,
  UnsupportedPlatformError,
  VoidhashError
} from './errors';

export type VoidhashClientOptions<TSchema extends VoidhashSchema> = {
  baseUrl?: string;
  userId?: string;
  scheme?: string;
  schema: TSchema;
  debug?: boolean;
};

export class VoidhashClient<TSchema extends VoidhashSchema> {
  private _isInitialized = false;
  private initialAppUserId: string | null;
  private scheme: string;
  private logger: Logger;
  private cacheManager: CacheManager;
  private identityManager: IdentityManager;
  private customerInfoManager: CustomerInfoManager;
  private customerAttributeManager: CustomerAttributeManager;
  private httpClient: HttpClient;
  private platformProvider: PlatformProvider;
  private schema: TSchema;
  private paymentAdapter: PaymentAdapter;
  private eventBus: EventBus;

  constructor(
    initialAppUserId: string | null,
    scheme: string,
    logger: Logger,
    cacheManager: CacheManager,
    customerInfoManager: CustomerInfoManager,
    identityManager: IdentityManager,
    customerAttributeManager: CustomerAttributeManager,
    schema: TSchema,
    paymentAdapter: PaymentAdapter,
    eventBus: EventBus,
    platformProvider: PlatformProvider,
    httpClient: HttpClient
  ) {
    this.initialAppUserId = initialAppUserId;
    this.scheme = scheme;
    this.logger = logger;
    this.cacheManager = cacheManager;
    this.customerInfoManager = customerInfoManager;
    this.identityManager = identityManager;
    this.customerAttributeManager = customerAttributeManager;
    this.schema = schema;
    this.paymentAdapter = paymentAdapter;
    this.eventBus = eventBus;
    this.platformProvider = platformProvider;
    this.httpClient = httpClient;
  }
  /**
   * Initializes the voidhash client.
   * @throws {FailedToInitializeNativeAdapterError} If the payment adapter fails to initialize
   */
  async init() {
    if (this.initialAppUserId) {
      // Identify as the user which ID was passed during SDK initialization
      this.logger.debug('Initializing with initial user id', {
        appUserId: this.initialAppUserId
      });

      // Sync customer attributes before identify to not lose historical customer data
      const appUserId = await this.identityManager.getAppUserIdFromCache();
      if (appUserId) {
        await this.customerAttributeManager.syncCustomerAttributes(appUserId);
      }

      await this.identityManager.identify(this.initialAppUserId, {});
    } else {
      // If no user ID was passed during SDK initialization, fetch the last identified customer from the server
      const appUserId = await this.identityManager.getAppUserId();
      this.logger.debug('Initializing without initial user id', {
        appUserId
      });

      await this.customerAttributeManager.syncCustomerAttributes(appUserId);

      // We don't need the result immediately. We do this to pre-fetch fresh customer data in the background.
      await this.customerInfoManager.getCustomer(appUserId, 'fetch');
    }

    await this.paymentAdapter.initConnection();
    this._isInitialized = true;
  }

  /**
   * Ends the voidhash client.
   * @throws {FailedToEndNativeAdapterError} If the payment adapter fails to end
   */
  async end() {
    await this.paymentAdapter.endConnection();
    this._isInitialized = false;
  }

  /**
   * Returns true if the voidhash client is initialized.
   */
  get isInitialized() {
    return this._isInitialized;
  }

  /**
   * Returns currently identified customer.
   * @returns Customer object.
   */
  async getCurrentCustomer(forceFetch = false) {
    this.ensureInitialized();

    const appUserId = await this.identityManager.getAppUserId();
    const customer = await this.customerInfoManager.getCustomer(
      appUserId,
      forceFetch ? 'fetch' : 'fetch-while-stale'
    );

    return customer;
  }

  /**
   * Identifies the user.
   * @param appUserId - Id used to identify the user. Make sure it is unique and hard to guess.
   */
  async identify(
    appUserId: string,
    options: {
      email?: string;
      name?: string;
    }
  ) {
    this.ensureInitialized();
    await this.identityManager.identify(appUserId, options);
  }

  /**
   * Signs out the user.
   */
  async signOut() {
    this.ensureInitialized();
    await this.identityManager.signOut();
  }

  /**
   * Returns products available on the current platform.
   * @throws {NotInitializedError} If the voidhash client is not initialized
   * @throws {FailedToGetProductsError} If the payment adapter fails to get products
   * @returns A map of product definitions to products. Each value can be null if the product is not available on the current platform.
   */
  async getProducts() {
    this.ensureInitialized();
    const productDefinitions = extractProductDefinitions(this.schema);
    const nativeProducts = await this.loadProductsCached(productDefinitions);
    return this.mapNativeProductsToProductMap(
      productDefinitions,
      nativeProducts
    );
  }

  /**
   * Purchases a product.
   * @throws {NotInitializedError} Voidhash client is not initialized. Call init() before calling this method.
   * @throws {FailedToBuyProductError} Failed to buy the product.
   * @throws {ProductNotFoundError} Product not found on the current platform.
   * @throws {PurchasePendingError} The purchase is pending. The purchase will be completed in the background.
   * @throws {PurchaseCancelledError} The customer has cancelled the purchase
   */
  async purchase(
    product: Exclude<
      InferGetProductResponseFromSchema<TSchema>[keyof InferGetProductResponseFromSchema<TSchema>],
      null
    >,
    _options: {
      method?: 'native';
    }
  ) {
    this.ensureInitialized();

    const buyProductResult = await this.paymentAdapter.buyProduct(product);

    if (buyProductResult.isErr()) {
      const err = buyProductResult.error;
      this.logger.error('Failed to buy product', {
        error: err,
        product
      });

      if (err.code === 'NATIVE_ADAPTER_NOT_INITIALIZED') {
        throw new NotInitializedError();
      }

      if (err.code === 'FAILED_TO_BUY_PRODUCT') {
        throw new FailedToBuyProductError(err.message, err.cause);
      }

      if (err.code === 'PRODUCT_NOT_FOUND') {
        throw new ProductNotFoundError(err.message, err.cause);
      }

      if (err.code === 'PURCHASE_PENDING') {
        throw new PurchasePendingError(err.message, err.cause);
      }

      if (err.code === 'USER_CANCELLED') {
        throw new PurchaseCancelledError(err.message, err.cause);
      }

      throw new UnknownVoidhashError();
    }

    // TODO: Send transaction to backend
    // biome-ignore lint/suspicious/noConsole: temporary
    console.log(this.httpClient);

    return;
  }

  // ===============================
  // IOS only methods
  // ===============================

  /**
   * Presents the code redemption sheet.
   * @throws {UnsupportedPlatformError} If the platform does not support the code redemption sheet
   * @throws {VoidhashError} If the code redemption sheet fails to present
   */
  async iosPresentCodeRedemptionSheet() {
    const result = await this.paymentAdapter.presentCodeRedemptionSheet?.();
    if (!result) {
      throw new UnsupportedPlatformError(
        'Present code redemption sheet is not supported on this platform'
      );
    }
    if (result.isErr()) {
      throw new VoidhashError(result.error.message, result.error.cause);
    }
  }

  /**
   * Shows the manage subscriptions screen.
   * @throws {UnsupportedPlatformError} If the platform does not support the manage subscriptions screen
   * @throws {VoidhashError} If the manage subscriptions screen fails to show
   */
  async iosShowManageSubscriptions() {
    const result = await this.paymentAdapter.showManageSubscriptions?.();
    if (!result) {
      throw new UnsupportedPlatformError(
        'Show manage subscriptions is not supported on this platform'
      );
    }
    if (result.isErr()) {
      throw new VoidhashError(result.error.message, result.error.cause);
    }
  }

  // ===============================
  // Internal helpers
  // ===============================

  internal_getPlatformProvider() {
    return this.platformProvider;
  }

  internal_getSchema() {
    return this.schema;
  }

  internal_getSuccessCallbackBaseUrl() {
    return `${this.scheme}://voidhash/callback/success`;
  }

  internal_getErrorCallbackBaseUrl() {
    return `${this.scheme}://voidhash/callback/error`;
  }

  internal_getEventBus() {
    return this.eventBus;
  }

  private ensureInitialized() {
    if (!this._isInitialized) {
      throw new VoidhashError(
        'VOIDHASH_CLIENT_NOT_INITIALIZED',
        new Error('ProductManager is not initialized')
      );
    }
  }

  // ===============================
  // Get products helpers
  // ===============================

  private generateCacheKeyFromProductDefinitions(
    productDefinitions: ExtractSchemaProductDefinitions<TSchema>
  ) {
    return `native-products:${JSON.stringify(productDefinitions)}`;
  }

  private async loadProductsCached(
    productDefinitions: ExtractSchemaProductDefinitions<TSchema>
  ) {
    const cacheKey =
      this.generateCacheKeyFromProductDefinitions(productDefinitions);

    const cachedProducts = await this.cacheManager.get<Product[]>(cacheKey);

    if (
      cachedProducts &&
      !(cachedProducts.isStale || cachedProducts.isExpired)
    ) {
      this.logger.debug('Products fetched from cache', {
        products: cachedProducts.value
      });
      return cachedProducts.value;
    }

    const nativeProductsResult =
      await this.paymentAdapter.getProducts(productDefinitions);

    if (nativeProductsResult.isErr()) {
      const err = nativeProductsResult.error;
      this.logger.error('Failed to get products from native adapter', {
        error: err,
        productDefinitions
      });

      if (err.code === 'FAILED_TO_GET_PRODUCTS') {
        throw new NotInitializedError();
      }

      if (err.code === 'NATIVE_ADAPTER_NOT_INITIALIZED') {
        throw new NotInitializedError();
      }

      // This should never happen. It is here to satisfy the type checker.
      throw new UnknownVoidhashError();
    }

    const nativeProducts = nativeProductsResult.value;

    this.logger.debug('Products fetched from native adapter', {
      products: nativeProducts
    });

    // Store products in cache
    await this.cacheManager.set(cacheKey, nativeProducts, {
      ttl: 1000 * 60 * 60 * 24 // 24 hours
    });

    return nativeProducts;
  }

  private mapNativeProductsToProductMap(
    productDefinitions: ExtractSchemaProductDefinitions<TSchema>,
    nativeProducts: Product[]
  ) {
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
  }

  // ===============================
  // Customer helpers
  // ===============================

  /**
   * Resets the cache.
   */
  async resetCache() {
    this.logger.debug('Resetting cache');
    const appUserId = await this.identityManager.getAppUserId();
    await Promise.all([
      this.cacheManager.clear(),
      this.cacheManager.delete(
        this.generateCacheKeyFromProductDefinitions(
          extractProductDefinitions(this.schema)
        )
      ),
      this.customerInfoManager.resetCache(appUserId)
    ]);
  }
}
