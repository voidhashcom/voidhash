import { FetchHttpClient } from "@effect/platform";
import { Cause, Effect, Exit, Layer, ManagedRuntime, pipe } from "effect";

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
import { type PlatformInfo } from "./core/platform/platform-provider";
import { ReactNativePlatformProvider } from "./core/platform/react-native-platform-provider";
import type {
  InferGetPaywallLocationInput,
  InferGetProductResponseFromSchema,
  VoidhashSchema,
} from "./core/schema";
import { SdkConfiguration } from "./core/sdk-configuration";
import { ReadOnlyModePurchaseNotAllowedError, VoidhashError } from "./errors";

export interface VoidhashClientOptions<TSchema extends VoidhashSchema> {
  baseUrl?: string;
  debug?: boolean;
  ingestUrl?: string;
  readOnly?: boolean;
  schema: TSchema;
  scheme?: string;
  unstable_swallowErrors?: boolean;
  userId?: string;
}

const CreateEffectRuntime = (
  platform: PlatformInfo["platform"],
  baseUrl: string,
  debug: boolean,
  ingestUrl: string | undefined,
  publishableKey: string,
  readOnly: boolean,
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
        Layer.succeed(SdkConfiguration, {
          baseUrl,
          debug,
          ingestUrl,
          publishableKey,
          readOnly,
        })
      )
    )
  );

const toErrorWithMessage = (code: string, unknownCause: unknown) => {
  const cause =
    unknownCause instanceof Error
      ? unknownCause
      : new Error(String(unknownCause));

  return new VoidhashError(`${code}: ${cause.message}`, cause);
};

type UninitializedEffectClient = ReturnType<
  typeof VoidhashEffectClient.makeUnitializedClient
>;

type InitializedEffectClient<TSchema extends VoidhashSchema> = ReturnType<
  typeof VoidhashEffectClient.makeInitializedClient<TSchema>
>;

export class VoidhashClient<TSchema extends VoidhashSchema> {
  private _isInitialized = false;
  private analyticsFlushInFlight: Promise<void> | null = null;
  private appLifecycleSubscription: { remove: () => void } | null = null;
  private preInitAnalyticsBuffer: Array<{ eventName: string; properties: Record<string, unknown> }> = [];
  private initialAppUserId: string | null;
  private readOnly: boolean;
  private scheme: string;
  private schema: TSchema;
  private unstableSwallowErrors: boolean;
  private eventBus: EventBus;

  private effectRuntime: ReturnType<typeof CreateEffectRuntime>;

  private unitializedClient: UninitializedEffectClient;
  private initializedClient?: InitializedEffectClient<TSchema>;

  constructor(
    initialAppUserId: string | null,
    scheme: string,
    schema: TSchema,
    baseUrl: string,
    ingestUrl: string | undefined,
    publishableKey: string,
    readOnly: boolean,
    unstableSwallowErrors: boolean,
    eventBus: EventBus,
    platform: Exclude<PlatformInfo["platform"], "unknown">,
    debug = false
  ) {
    this.initialAppUserId = initialAppUserId;
    this.readOnly = readOnly;
    this.scheme = scheme;
    this.schema = schema;
    this.unstableSwallowErrors = unstableSwallowErrors;
    this.eventBus = eventBus;
    this.effectRuntime = CreateEffectRuntime(
      platform,
      baseUrl,
      debug,
      ingestUrl,
      publishableKey,
      readOnly,
      eventBus
    );
    this.unitializedClient = VoidhashEffectClient.makeUnitializedClient();
  }

  private async runSideEffect(
    operation: string,
    effect: () => Promise<void>
  ) {
    try {
      await effect();
    } catch (error) {
      if (!this.unstableSwallowErrors) {
        throw error;
      }

      // biome-ignore lint/suspicious/noConsole: This warning is intentionally surfaced in all environments.
      console.warn(`[voidhash] swallowed error in ${operation}`, error);
    }
  }
  /**
   * Initializes the voidhash client.
   * @throws {FailedToInitializeNativeAdapterError} If the payment adapter fails to initialize
   */
  async init() {
    await this.runSideEffect("init", async () => {
      const initializedClient = await this.runEffect(
        this.unitializedClient.init<TSchema>({
          initialAppUserId: this.initialAppUserId ?? undefined,
          schema: this.schema,
        }),
        "FAILED_TO_INITIALIZE_VOIDHASH_CLIENT"
      );

      await this.runEffect(
        initializedClient.startTransactionObserver((transaction) => {
          void this.effectRuntime.runPromiseExit(
            initializedClient.processObservedTransaction(transaction)
          );
        }),
        "FAILED_TO_INITIALIZE_VOIDHASH_CLIENT"
      );

      void this.effectRuntime.runPromiseExit(
        initializedClient.reconcileObservedTransactions()
      );

      this.initializedClient = initializedClient;
      this._isInitialized = true;

      // Set up analytics flush callback and transfer pre-init buffer
      initializedClient.setAnalyticsFlushCallback(() => {
        this.triggerBackgroundFlush("flush analytics from timer");
      });

      if (this.preInitAnalyticsBuffer.length > 0) {
        this.effectRuntime.runSync(
          initializedClient.transferAnalyticsEvents(this.preInitAnalyticsBuffer)
        );
        this.preInitAnalyticsBuffer = [];
      }

      await this.runEffect(
        initializedClient.captureAutomaticStartupEvents(),
        "FAILED_TO_CAPTURE_STARTUP_EVENTS"
      ).catch((error) => {
        // biome-ignore lint/suspicious/noConsole: This warning is intentionally surfaced in all environments.
        console.warn("[voidhash] failed to capture automatic startup analytics", error);
      });

      this.appLifecycleSubscription = this.effectRuntime.runSync(
        initializedClient.setupAutomaticLifecycleEvents((eventName) => {
          this.capture(eventName);
        })
      );

      this.triggerBackgroundFlush("flush analytics after init");
    });
  }

  /**
   * Ends the voidhash client.
   * @throws {FailedToEndNativeAdapterError} If the payment adapter fails to end
   */
  async end() {
    await this.runSideEffect("end", async () => {
      this.ensureInitialized();
      await this.flush();
      await this.runEffect(this.initializedClient!.end(), "FAILED_TO_END_VOIDHASH_CLIENT");
      this.appLifecycleSubscription?.remove();
      this.appLifecycleSubscription = null;
      this._isInitialized = false;
    });
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
    return this.runEffect(this.initializedClient!.getCurrentCustomer(forceFetch), "FAILED_TO_GET_CURRENT_CUSTOMER");
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
    await this.runSideEffect("identify", async () => {
      this.ensureInitialized();
      await this.runEffect(this.initializedClient!.identify(appUserId, options), "FAILED_TO_IDENTIFY");
    });
  }

  /**
   * Signs out the user.
   */
  async signOut() {
    await this.runSideEffect("signOut", async () => {
      this.ensureInitialized();
      await this.runEffect(this.initializedClient!.signOut(), "FAILED_TO_SIGN_OUT");
    });
  }

  /**
   * Returns feature flag evaluation results.
   * @param flagKeys - Optional array of specific flag keys to evaluate. If omitted, evaluates all flags.
   * @returns Feature flags evaluation result with enabled status, variant keys, and payloads.
   */
  async getFeatureFlags(flagKeys?: string[]) {
    this.ensureInitialized();
    return this.runEffect(this.initializedClient!.getFeatureFlags(flagKeys), "FAILED_TO_GET_FEATURE_FLAGS");
  }

  /**
   * Resolves the currently assigned paywall showing for a location slug.
   */
  async getPaywallForLocation(
    locationSlug: InferGetPaywallLocationInput<TSchema>
  ) {
    this.ensureInitialized();
    return this.runEffect(this.initializedClient!.getPaywallForLocation(locationSlug), "FAILED_TO_GET_PAYWALL_FOR_LOCATION");
  }

  /**
   * Returns products available on the current platform.
   * @throws {NotInitializedError} If the voidhash client is not initialized
   * @throws {FailedToGetProductsError} If the payment adapter fails to get products
   * @returns A map of product definitions to products. Each value can be null if the product is not available on the current platform.
   */
  async getProducts() {
    this.ensureInitialized();
    return this.runEffect(this.initializedClient!.getProducts(), "FAILED_TO_GET_PRODUCTS");
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
    if (this.readOnly) {
      throw new ReadOnlyModePurchaseNotAllowedError();
    }

    await this.runEffect(this.initializedClient!.purchase<TSchema>(product, _options), "FAILED_TO_PURCHASE");
  }

  /**
   * Restores purchases by reconciling pending/past store transactions and refreshing customer state.
   */
  async restorePurchases() {
    await this.runSideEffect("restorePurchases", async () => {
      this.ensureInitialized();
      await this.runEffect(this.initializedClient!.restorePurchases(), "FAILED_TO_RESTORE_PURCHASES");
    });
  }

  /**
   * Captures a product analytics event.
   * Events are batched and delivered on size/time thresholds.
   */
  capture(eventName: string, properties: Record<string, unknown> = {}) {
    if (!this.initializedClient) {
      const normalized = eventName.trim();
      if (normalized) {
        this.preInitAnalyticsBuffer.push({ eventName: normalized, properties });
      }
      return;
    }

    this.effectRuntime.runSync(
      this.initializedClient.capture(eventName, properties)
    );
  }

  /**
   * Flushes queued analytics events.
   */
  async flush() {
    await this.runSideEffect("flush", async () => {
      if (this.analyticsFlushInFlight) {
        await this.analyticsFlushInFlight;
        return;
      }

      if (!this.initializedClient) return;

      this.analyticsFlushInFlight = this.runEffect(
        this.initializedClient.flush(),
        "FAILED_TO_FLUSH_ANALYTICS"
      ).finally(() => {
        this.analyticsFlushInFlight = null;
      });

      await this.analyticsFlushInFlight;
    });
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
    await this.runSideEffect("iosPresentCodeRedemptionSheet", async () => {
      this.ensureInitialized();
      await this.runEffect(this.initializedClient!.iosPresentCodeRedemptionSheet(), "FAILED_TO_PRESENT_CODE_REDEMPTION_SHEET");
    });
  }

  /**
   * Shows the manage subscriptions screen.
   * @throws {UnsupportedPlatformError} If the platform does not support the manage subscriptions screen
   * @throws {VoidhashError} If the manage subscriptions screen fails to show
   */
  async iosShowManageSubscriptions() {
    await this.runSideEffect("iosShowManageSubscriptions", async () => {
      this.ensureInitialized();
      await this.runEffect(this.initializedClient!.iosShowManageSubscriptions(), "FAILED_TO_SHOW_MANAGE_SUBSCRIPTIONS");
    });
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

  private triggerBackgroundFlush(operation: string) {
    void this.flush().catch((error) => {
      // biome-ignore lint/suspicious/noConsole: This warning is intentionally surfaced in all environments.
      console.warn(`[voidhash] failed to ${operation}`, error);
    });
  }

  // biome-ignore lint/suspicious/noExplicitAny: Effect requires service type parameter
  private async runEffect<T>(effect: Effect.Effect<T, unknown, any>, errorCode: string): Promise<T> {
    const result = await this.effectRuntime.runPromiseExit(effect);
    if (Exit.isSuccess(result)) return result.value;
    throw toErrorWithMessage(errorCode, Cause.squash(result.cause));
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
