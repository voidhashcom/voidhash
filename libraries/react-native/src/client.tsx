import { FetchHttpClient } from "@effect/platform";
import { Exit, Layer, ManagedRuntime, pipe } from "effect";

import { VoidhashEffectClient } from "./client-effect";
import { AsyncStorageCacheAdapter } from "./core/caching/async-storage-cache";
import { CacheManager } from "./core/caching/cache-manager";
import { type EventBus, EventBusProvider } from "./core/event-bus";
import { CustomerAttributeManager } from "./core/identity/customer-attribute-manager";
import { CustomerInfoManager } from "./core/identity/customer-info-manager";
import { IdentityManager } from "./core/identity/identity-manager";
import { ApiClient } from "./core/networking/api-client";
import { AppStoreAdapter } from "./core/payment-adapters/app-store-adapter";
import { GooglePlayAdapter } from "./core/payment-adapters/google-play-adapter";
import type { PlatformInfo } from "./core/platform/platform-provider";
import { ReactNativePlatformProvider } from "./core/platform/react-native-platform-provider";
import type {
  InferGetProductResponseFromSchema,
  VoidhashSchema,
} from "./core/schema";
import { SdkConfiguration } from "./core/sdk-configuration";
import { VoidhashError } from "./errors";

export interface VoidhashClientOptions<TSchema extends VoidhashSchema> {
  baseUrl?: string;
  userId?: string;
  scheme?: string;
  schema: TSchema;
  debug?: boolean;
}

const CreateEffectRuntime = (
  platform: PlatformInfo["platform"],
  baseUrl: string,
  publishableKey: string,
  eventBus: EventBus
) =>
  ManagedRuntime.make(
    pipe(
      CustomerAttributeManager.Default,
      Layer.provideMerge(CustomerInfoManager.Default),
      Layer.provideMerge(IdentityManager.Default),
      Layer.provideMerge(CacheManager.Default),
      Layer.provideMerge(AsyncStorageCacheAdapter),
      Layer.provideMerge(ApiClient.Default),
      Layer.provideMerge(FetchHttpClient.layer),
      Layer.provideMerge(
        platform === "ios" ? AppStoreAdapter : GooglePlayAdapter
      ),
      Layer.provideMerge(Layer.succeed(EventBusProvider, eventBus)),
      Layer.provideMerge(ReactNativePlatformProvider),
      Layer.provideMerge(
        Layer.succeed(SdkConfiguration, { baseUrl, publishableKey })
      )
    )
  );

export class VoidhashClient<TSchema extends VoidhashSchema> {
  private _isInitialized = false;
  private initialAppUserId: string | null;
  private scheme: string;
  private schema: TSchema;
  private eventBus: EventBus;

  private effectRuntime: ReturnType<typeof CreateEffectRuntime>;

  private unitializedClient: ReturnType<
    typeof VoidhashEffectClient.makeUnitializedClient
  >;
  private initializedClient?: ReturnType<
    typeof VoidhashEffectClient.makeInitializedClient
  >;

  constructor(
    initialAppUserId: string | null,
    scheme: string,
    schema: TSchema,
    baseUrl: string,
    publishableKey: string,
    eventBus: EventBus,
    platform: Exclude<PlatformInfo["platform"], "unknown">
  ) {
    this.initialAppUserId = initialAppUserId;
    this.scheme = scheme;
    this.schema = schema;
    this.eventBus = eventBus;
    this.effectRuntime = CreateEffectRuntime(
      platform,
      baseUrl,
      publishableKey,
      eventBus
    );
    this.unitializedClient = VoidhashEffectClient.makeUnitializedClient();
  }
  /**
   * Initializes the voidhash client.
   * @throws {FailedToInitializeNativeAdapterError} If the payment adapter fails to initialize
   */
  async init() {
    const initializedClientResult = await this.effectRuntime.runPromiseExit(
      this.unitializedClient.init<TSchema>({
        initialAppUserId: this.initialAppUserId ?? undefined,
        schema: this.schema,
      })
    );

    if (Exit.isSuccess(initializedClientResult)) {
      this.initializedClient = initializedClientResult.value;
      return;
    }

    // TODO: Handle different erros that can happen properly
    throw new VoidhashError("FAILED_TO_INITIALIZE_VOIDHASH_CLIENT");
  }

  /**
   * Ends the voidhash client.
   * @throws {FailedToEndNativeAdapterError} If the payment adapter fails to end
   */
  async end() {
    this.ensureInitialized();
    const endResult = await this.effectRuntime.runPromiseExit(
      // biome-ignore lint/style/noNonNullAssertion: ensureInitialized ensures that this.initializedClient is not null
      this.initializedClient!.end()
    );

    if (Exit.isSuccess(endResult)) {
      this._isInitialized = false;
      return;
    }

    // TODO: Handle different erros that can happen properly
    throw new VoidhashError("FAILED_TO_END_VOIDHASH_CLIENT");
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

    const currentCustomerResult = await this.effectRuntime.runPromiseExit(
      // biome-ignore lint/style/noNonNullAssertion: ensureInitialized ensures that this.initializedClient is not null
      this.initializedClient!.getCurrentCustomer(forceFetch)
    );

    if (Exit.isSuccess(currentCustomerResult)) {
      return currentCustomerResult.value;
    }

    // TODO: Handle different erros that can happen properly
    throw new VoidhashError("FAILED_TO_GET_CURRENT_CUSTOMER");
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
    const identifyResult = await this.effectRuntime.runPromiseExit(
      // biome-ignore lint/style/noNonNullAssertion: ensureInitialized ensures that this.initializedClient is not null
      this.initializedClient!.identify(appUserId, options)
    );

    if (Exit.isSuccess(identifyResult)) {
      return;
    }

    // TODO: Handle different erros that can happen properly
    throw new VoidhashError("FAILED_TO_IDENTIFY");
  }

  /**
   * Signs out the user.
   */
  async signOut() {
    this.ensureInitialized();
    const signOutResult = await this.effectRuntime.runPromiseExit(
      // biome-ignore lint/style/noNonNullAssertion: ensureInitialized ensures that this.initializedClient is not null
      this.initializedClient!.signOut()
    );

    if (Exit.isSuccess(signOutResult)) {
      return;
    }

    // TODO: Handle different erros that can happen properly
    throw new VoidhashError("FAILED_TO_SIGN_OUT");
  }

  /**
   * Returns products available on the current platform.
   * @throws {NotInitializedError} If the voidhash client is not initialized
   * @throws {FailedToGetProductsError} If the payment adapter fails to get products
   * @returns A map of product definitions to products. Each value can be null if the product is not available on the current platform.
   */
  async getProducts() {
    this.ensureInitialized();
    const getProductsResult = await this.effectRuntime.runPromiseExit(
      // biome-ignore lint/style/noNonNullAssertion: ensureInitialized ensures that this.initializedClient is not null
      this.initializedClient!.getProducts()
    );

    if (Exit.isSuccess(getProductsResult)) {
      return getProductsResult.value;
    }

    // TODO: Handle different erros that can happen properly
    throw new VoidhashError("FAILED_TO_GET_PRODUCTS");
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
    product: NonNullable<
      InferGetProductResponseFromSchema<TSchema>[keyof InferGetProductResponseFromSchema<TSchema>]
    >,
    _options: {
      method?: "native";
    }
  ) {
    this.ensureInitialized();
    const purchaseResult = await this.effectRuntime.runPromiseExit(
      // biome-ignore lint/style/noNonNullAssertion: ensureInitialized ensures that this.initializedClient is not null
      this.initializedClient!.purchase<TSchema>(product, _options)
    );

    if (Exit.isSuccess(purchaseResult)) {
      return;
    }

    // TODO: Handle different erros that can happen properly
    throw new VoidhashError("FAILED_TO_PURCHASE");
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
    this.ensureInitialized();
    const presentCodeRedemptionSheetResult =
      await this.effectRuntime.runPromiseExit(
        // biome-ignore lint/style/noNonNullAssertion: ensureInitialized ensures that this.initializedClient is not null
        this.initializedClient!.iosPresentCodeRedemptionSheet()
      );

    if (Exit.isSuccess(presentCodeRedemptionSheetResult)) {
      return;
    }

    // TODO: Handle different erros that can happen properly
    throw new VoidhashError("FAILED_TO_PRESENT_CODE_REDEMPTION_SHEET");
  }

  /**
   * Shows the manage subscriptions screen.
   * @throws {UnsupportedPlatformError} If the platform does not support the manage subscriptions screen
   * @throws {VoidhashError} If the manage subscriptions screen fails to show
   */
  async iosShowManageSubscriptions() {
    this.ensureInitialized();
    const showManageSubscriptionsResult =
      await this.effectRuntime.runPromiseExit(
        // biome-ignore lint/style/noNonNullAssertion: ensureInitialized ensures that this.initializedClient is not null
        this.initializedClient!.iosShowManageSubscriptions()
      );

    if (Exit.isSuccess(showManageSubscriptionsResult)) {
      return;
    }

    // TODO: Handle different erros that can happen properly
    throw new VoidhashError("FAILED_TO_SHOW_MANAGE_SUBSCRIPTIONS");
  }

  // ===============================
  // Internal helpers
  // ===============================

  internal_getEventBus() {
    return this.eventBus;
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

  private ensureInitialized() {
    if (!this.initializedClient) {
      throw new VoidhashError(
        "VOIDHASH_CLIENT_NOT_INITIALIZED",
        new Error("ProductManager is not initialized")
      );
    }
  }

  // ===============================
  // Customer helpers
  // ===============================

  /**
   * Resets the cache.
   */
  async resetCache() {
    // TODO: Implement
  }
}
