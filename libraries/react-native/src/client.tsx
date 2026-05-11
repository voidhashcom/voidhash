import { Cause, Effect, Exit, Layer, ManagedRuntime, pipe } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

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
import { FeatureFlagService } from "./core/feature-flags/feature-flag-service";
import { LifecycleService } from "./core/lifecycle/lifecycle-service";
import { ReactNativeLifecycleAdapter } from "./core/lifecycle/react-native-lifecycle-adapter";
import { PaywallService } from "./core/paywalls/paywall-service";
import { type PlatformInfo } from "./core/platform/platform-provider";
import { ReactNativePlatformProvider } from "./core/platform/react-native-platform-provider";
import { ProductService } from "./core/products/product-service";
import { TransactionService } from "./core/transactions/transaction-service";
import type { LocationSlug, ProductSlug } from "./core/schema/registry";
import type { RuntimeSchema } from "./core/schema/runtime";
import { SdkConfiguration } from "./core/sdk-configuration";
import { ReadOnlyModePurchaseNotAllowedError, VoidhashError } from "./errors";
import { AnalyticsService } from "./core/analytics/service";
import type { SubscriptionProduct } from "./core/entities/product";

export interface VoidhashClientOptions {
  baseUrl?: string;
  debug?: boolean;
  distinctId?: string;
  ingestUrl?: string;
  readOnly?: boolean;
  scheme?: string;
  unstable_swallowErrors?: boolean;
  /**
   * Test/internal escape hatch — inject a known runtime schema instead of
   * letting the SDK fetch from the server on init. Not part of the public
   * API; production code should rely on the server-side schema endpoint.
   */
  unstable_internalSchema?: RuntimeSchema;
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
      Layer.provideMerge(ProductService.layer),
      Layer.provideMerge(FeatureFlagService.layer),
      Layer.provideMerge(PaywallService.layer),
      Layer.provideMerge(TransactionService.layer),
      Layer.provideMerge(AnalyticsService.layer),
      Layer.provideMerge(LifecycleService.layer),
      Layer.provideMerge(ReactNativeLifecycleAdapter),
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

// `makeInitializedClient` now returns `Effect<Facade, ...>` — unwrap to the
// facade type by extracting the Effect's Success channel.
type InitializedEffectClient = Effect.Success<
  ReturnType<typeof VoidhashEffectClient.makeInitializedClient>
>;

export class VoidhashClient {
  private _isInitialized = false;
  private analyticsFlushInFlight: Promise<void> | null = null;
  private appLifecycleSubscription: { remove: () => void } | null = null;
  private preInitAnalyticsBuffer: Array<{
    eventName: string;
    properties: Record<string, unknown>;
  }> = [];
  private initialDistinctId: string | null;
  private readOnly: boolean;
  private scheme: string;
  private internalSchema: RuntimeSchema | undefined;
  private unstableSwallowErrors: boolean;
  private eventBus: EventBus;

  private effectRuntime: ReturnType<typeof CreateEffectRuntime>;

  private unitializedClient: UninitializedEffectClient;
  private initializedClient?: InitializedEffectClient;

  constructor(
    initialDistinctId: string | null,
    scheme: string,
    baseUrl: string,
    ingestUrl: string | undefined,
    publishableKey: string,
    readOnly: boolean,
    unstableSwallowErrors: boolean,
    eventBus: EventBus,
    platform: Exclude<PlatformInfo["platform"], "unknown">,
    debug = false,
    internalSchema?: RuntimeSchema
  ) {
    this.initialDistinctId = initialDistinctId;
    this.readOnly = readOnly;
    this.scheme = scheme;
    this.internalSchema = internalSchema;
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

  private async runSideEffect(operation: string, effect: () => Promise<void>) {
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
   * Initializes the voidhash client. Fetches the runtime schema from the
   * server (or uses the injected internal schema if one was provided for tests).
   * @throws {FailedToInitializeNativeAdapterError} If the payment adapter fails to initialize
   */
  async init() {
    await this.runSideEffect("init", async () => {
      const initializedClient = await this.runEffect(
        this.unitializedClient.init({
          distinctId: this.initialDistinctId ?? undefined,
          internalSchema: this.internalSchema,
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
        console.warn(
          "[voidhash] failed to capture automatic startup analytics",
          error
        );
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
      await this.runEffect(
        this.initializedClient!.end(),
        "FAILED_TO_END_VOIDHASH_CLIENT"
      );
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
   */
  async getCurrentCustomer(forceFetch = false) {
    this.ensureInitialized();
    return this.runEffect(
      this.initializedClient!.getCurrentCustomer(forceFetch),
      "FAILED_TO_GET_CURRENT_CUSTOMER"
    );
  }

  async getDistinctId() {
    this.ensureInitialized();
    return this.runEffect(
      this.initializedClient!.getDistinctId(),
      "FAILED_TO_GET_DISTINCT_ID"
    );
  }

  /**
   * Identifies the user by switching the current distinct id.
   */
  async identify(
    externalUserId: string,
    options: {
      email?: string;
      name?: string;
    }
  ) {
    await this.runSideEffect("identify", async () => {
      this.ensureInitialized();
      await this.runEffect(
        this.initializedClient!.identify(externalUserId, options),
        "FAILED_TO_IDENTIFY"
      );
    });
  }

  /**
   * Resets the current identity to a fresh anonymous distinct id.
   */
  async reset() {
    await this.runSideEffect("reset", async () => {
      this.ensureInitialized();
      await this.runEffect(this.initializedClient!.reset(), "FAILED_TO_RESET");
    });
  }

  async signOut() {
    return this.reset();
  }

  /**
   * Returns feature flag evaluation results.
   */
  async getFeatureFlags(flagKeys?: string[]) {
    this.ensureInitialized();
    return this.runEffect(
      this.initializedClient!.getFeatureFlags(flagKeys),
      "FAILED_TO_GET_FEATURE_FLAGS"
    );
  }

  /**
   * Resolves the currently assigned paywall showing for a location slug.
   */
  async getPaywallForLocation(locationSlug: LocationSlug) {
    this.ensureInitialized();
    return this.runEffect(
      this.initializedClient!.getPaywallForLocation(locationSlug),
      "FAILED_TO_GET_PAYWALL_FOR_LOCATION"
    );
  }

  /**
   * Returns products available on the current platform.
   * Keys are the project's product slugs (resolved via the generated
   * `voidhash.gen.d.ts`). Values are `null` when the underlying store SDK
   * doesn't know about that product.
   */
  async getProducts() {
    this.ensureInitialized();
    return this.runEffect(
      this.initializedClient!.getProducts(),
      "FAILED_TO_GET_PRODUCTS"
    );
  }

  /**
   * Purchases a product.
   */
  async purchase(
    product: SubscriptionProduct,
    _options: {
      method?: "native";
    }
  ) {
    this.ensureInitialized();
    if (this.readOnly) {
      throw new ReadOnlyModePurchaseNotAllowedError();
    }

    await this.runEffect(
      this.initializedClient!.purchase(product, _options),
      "FAILED_TO_PURCHASE"
    );
  }

  /**
   * Restores purchases by reconciling pending/past store transactions and
   * refreshing customer state.
   */
  async restorePurchases() {
    await this.runSideEffect("restorePurchases", async () => {
      this.ensureInitialized();
      await this.runEffect(
        this.initializedClient!.restorePurchases(),
        "FAILED_TO_RESTORE_PURCHASES"
      );
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

  async iosPresentCodeRedemptionSheet() {
    await this.runSideEffect("iosPresentCodeRedemptionSheet", async () => {
      this.ensureInitialized();
      await this.runEffect(
        this.initializedClient!.iosPresentCodeRedemptionSheet(),
        "FAILED_TO_PRESENT_CODE_REDEMPTION_SHEET"
      );
    });
  }

  async iosShowManageSubscriptions() {
    await this.runSideEffect("iosShowManageSubscriptions", async () => {
      this.ensureInitialized();
      await this.runEffect(
        this.initializedClient!.iosShowManageSubscriptions(),
        "FAILED_TO_SHOW_MANAGE_SUBSCRIPTIONS"
      );
    });
  }

  // ===============================
  // Internal helpers
  // ===============================

  internal_getEventBus() {
    return this.eventBus;
  }

  /**
   * Returns the runtime schema fetched at init time. Returns `null` when the
   * client hasn't been initialized yet. Used by hooks that need to resolve
   * slugs to product metadata.
   */
  internal_getSchema(): RuntimeSchema | null {
    return this.initializedClient?.getSchema() ?? null;
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
  private async runEffect<T>(
    effect: Effect.Effect<T, unknown, any>,
    errorCode: string
  ): Promise<T> {
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

/** Convenience re-export to keep `ProductSlug` reachable from this module. */
export type { ProductSlug };
