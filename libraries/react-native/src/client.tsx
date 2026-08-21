import { Cause, Effect, Exit, Layer, ManagedRuntime, pipe } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { AtomRegistry } from "effect/unstable/reactivity";

import { VoidhashEffectClient } from "./client-effect";
import { AnalyticsService } from "./core/analytics/service";
import { AsyncStorageCacheAdapter } from "./core/caching/async-storage-cache";
import { CacheManager } from "./core/caching/cache-manager";
import type { Product } from "./core/entities/product";
import {
  type FeatureFlagsResult,
  FeatureFlagService,
} from "./core/feature-flags/feature-flag-service";
import {
  type PersonAttributes,
  PersonAttributeManager,
} from "./core/identity/person-attribute-manager";
import { PersonInfoManager } from "./core/identity/person-info-manager";
import { IdentityManager } from "./core/identity/identity-manager";
import { LifecycleService } from "./core/lifecycle/lifecycle-service";
import { ReactNativeLifecycleAdapter } from "./core/lifecycle/react-native-lifecycle-adapter";
import { ApiClient } from "./core/networking/api-client";
import { AppStoreAdapter } from "./core/payment-adapters/app-store-adapter";
import { GooglePlayAdapter } from "./core/payment-adapters/google-play-adapter";
import { PaymentAdapter } from "./core/payment-adapters/payment-adapter";
import { type PaywallReleaseRuntime, PaywallService } from "./core/paywalls/paywall-service";
import type { PlatformInfo } from "./core/platform/platform-provider";
import { ReactNativePlatformProvider } from "./core/platform/react-native-platform-provider";
import { type ProductsBySlug, ProductService } from "./core/products/product-service";
import type { LocationSlug, ProductSlug } from "./core/schema/registry";
import type { RuntimeSchema } from "./core/schema/runtime";
import { SchemaManager } from "./core/schema/schema-manager";
import {
  type SdkConfigurationHandle,
  SdkConfiguration,
  makeSdkConfiguration,
} from "./core/sdk-configuration";
import { TransactionService } from "./core/transactions/transaction-service";
import { ReadOnlyModePurchaseNotAllowedError, VoidhashError } from "./errors";
import type { PaywallRuntimeConfig } from "./internal/paywall-bridge/protocol";

export interface VoidhashClientOptions {
  baseUrl?: string;
  debug?: boolean;
  /** Enables isolated test purchases in debug builds. Release builds always ignore this option. */
  dev?: boolean;
  distinctId?: string;
  /**
   * Ships the SDK fully disabled (default `true`). A disabled client never
   * connects to the native store, never talks to the network and never
   * registers listeners: `init()` and every side-effect method resolve as
   * no-ops, and reads answer with their empty shape. Intended for
   * feature-flagged rollouts, where mounting the provider unconditionally
   * avoids hook-order violations.
   *
   * Fixed at construction. Enabling the SDK later means creating a new client
   * — cheap, because a disabled client never builds its Effect runtime and so
   * holds no store connection, timers or listeners.
   */
  enabled?: boolean;
  ingestUrl?: string;
  /**
   * Starts the SDK in observer mode: transactions are reported to Voidhash but
   * never finished/acknowledged with the store, and purchases are blocked. Can
   * be flipped later with `client.setReadOnly()`.
   */
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
  developmentMode: boolean,
  atomRegistry: AtomRegistry.AtomRegistry,
  sdkConfiguration: typeof SdkConfiguration.Service,
) => {
  // oxlint-disable effect/noDynamicImports -- This debug-only edge must stay dynamic so Metro can omit the adapter from release bundles.
  const paymentAdapterLayer: Layer.Layer<PaymentAdapter> =
    __DEV__ && developmentMode
      ? (
          require("./core/payment-adapters/development-payment-adapter") as {
            DevelopmentPaymentAdapter: Layer.Layer<PaymentAdapter>;
          }
        ).DevelopmentPaymentAdapter
      : platform === "ios"
        ? AppStoreAdapter
        : GooglePlayAdapter;
  // oxlint-enable effect/noDynamicImports
  return ManagedRuntime.make(
    pipe(
      PersonAttributeManager.Default,
      Layer.provideMerge(ProductService.layer),
      Layer.provideMerge(FeatureFlagService.layer),
      Layer.provideMerge(PaywallService.layer),
      Layer.provideMerge(TransactionService.layer),
      Layer.provideMerge(AnalyticsService.layer),
      Layer.provideMerge(LifecycleService.layer),
      Layer.provideMerge(ReactNativeLifecycleAdapter),
      Layer.provideMerge(PersonInfoManager.Default),
      Layer.provideMerge(SchemaManager.layer),
      Layer.provideMerge(IdentityManager.Default),
      Layer.provideMerge(CacheManager.Default),
      Layer.provideMerge(AsyncStorageCacheAdapter),
      Layer.provideMerge(ApiClient.Default),
      Layer.provideMerge(FetchHttpClient.layer),
      Layer.provideMerge(paymentAdapterLayer),
      Layer.provideMerge(Layer.succeed(AtomRegistry.AtomRegistry, atomRegistry)),
      Layer.provideMerge(ReactNativePlatformProvider),
      Layer.provideMerge(Layer.succeed(SdkConfiguration, sdkConfiguration)),
    ),
  );
};

/** Feature flag answer of a disabled client: no flags were ever evaluated. */
const DISABLED_FEATURE_FLAGS: FeatureFlagsResult = { flags: [] };

/** Paywall runtime config answer of a disabled client. */
const DISABLED_PAYWALL_RUNTIME_CONFIG: PaywallRuntimeConfig = { products: [], variables: {} };

const toErrorWithMessage = (code: string, unknownCause: unknown) => {
  const cause = unknownCause instanceof Error ? unknownCause : new Error(String(unknownCause));

  return new VoidhashError(`${code}: ${cause.message}`, cause);
};

type UninitializedEffectClient = ReturnType<typeof VoidhashEffectClient.makeUnitializedClient>;

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
  private enabled: boolean;
  private sdkConfiguration: SdkConfigurationHandle;
  private scheme: string;
  private internalSchema: RuntimeSchema | undefined;
  private unstableSwallowErrors: boolean;
  private atomRegistry: AtomRegistry.AtomRegistry;
  private developmentMode: boolean;

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
    atomRegistry: AtomRegistry.AtomRegistry,
    platform: Exclude<PlatformInfo["platform"], "unknown">,
    debug = false,
    internalSchema?: RuntimeSchema,
    dev = false,
    enabled = true,
  ) {
    this.initialDistinctId = initialDistinctId;
    this.enabled = enabled;
    this.developmentMode = __DEV__ && dev;
    this.scheme = scheme;
    this.internalSchema = internalSchema;
    this.unstableSwallowErrors = unstableSwallowErrors;
    this.atomRegistry = atomRegistry;
    this.sdkConfiguration = makeSdkConfiguration({
      baseUrl,
      debug,
      developmentMode: this.developmentMode,
      ingestUrl,
      publishableKey,
      readOnly,
    });
    this.effectRuntime = CreateEffectRuntime(
      platform,
      this.developmentMode,
      atomRegistry,
      this.sdkConfiguration.service,
    );
    this.unitializedClient = VoidhashEffectClient.makeUnitializedClient();
  }

  private async runSideEffect(operation: string, effect: () => Promise<void>) {
    await Effect.runPromise(
      Effect.tryPromise({ try: () => effect(), catch: (error) => error }).pipe(
        Effect.catch((error) => {
          if (!this.unstableSwallowErrors) {
            return Effect.die(error);
          }

          // This warning is intentionally surfaced in all environments.
          return Effect.sync(() => {
            console.warn(`[voidhash] swallowed error in ${operation}`, error);
          });
        }),
      ),
    );
  }

  /**
   * Initializes the voidhash client. Fetches the runtime schema from the
   * server (or uses the injected internal schema if one was provided for tests).
   * Resolves immediately without touching the store, the network or the
   * cache when the client was created with `enabled: false`.
   * @throws {FailedToInitializeNativeAdapterError} If the payment adapter fails to initialize
   */
  async init() {
    if (!this.enabled) {
      return;
    }

    await this.runSideEffect("init", async () => {
      const initializedClient = await this.runEffect(
        this.unitializedClient.init({
          distinctId: this.initialDistinctId ?? undefined,
          internalSchema: this.internalSchema,
        }),
        "FAILED_TO_INITIALIZE_VOIDHASH_CLIENT",
      );

      await this.runEffect(
        initializedClient.startTransactionObserver((transaction) => {
          void this.effectRuntime.runPromiseExit(
            initializedClient.processObservedTransaction(transaction),
          );
        }),
        "FAILED_TO_INITIALIZE_VOIDHASH_CLIENT",
      );

      void this.effectRuntime.runPromiseExit(initializedClient.reconcileObservedTransactions());

      this.initializedClient = initializedClient;
      this._isInitialized = true;

      // Set up analytics flush callback and transfer pre-init buffer
      initializedClient.setAnalyticsFlushCallback(() => {
        this.triggerBackgroundFlush("flush analytics from timer");
      });

      if (this.preInitAnalyticsBuffer.length > 0) {
        this.effectRuntime.runSync(
          initializedClient.transferAnalyticsEvents(this.preInitAnalyticsBuffer),
        );
        this.preInitAnalyticsBuffer = [];
      }

      await this.runEffect(
        initializedClient.captureAutomaticStartupEvents(),
        "FAILED_TO_CAPTURE_STARTUP_EVENTS",
      ).catch((error) => {
        // This warning is intentionally surfaced in all environments.
        console.warn("[voidhash] failed to capture automatic startup analytics", error);
      });

      // Awaited rather than run synchronously: `LifecycleAdapter.subscribe` is
      // an Effect the adapter owns, and an asynchronous implementation would
      // die under `runSync` — rejecting `init()` long after the client was
      // marked initialized and leaving a half-live client behind.
      this.appLifecycleSubscription = await this.runEffect(
        initializedClient.setupAutomaticLifecycleEvents((eventName) => {
          this.capture(eventName);
        }),
        "FAILED_TO_SETUP_LIFECYCLE_EVENTS",
      );

      this.triggerBackgroundFlush("flush analytics after init");
    });
  }

  /**
   * Ends the voidhash client. No-ops on a disabled client, which never
   * acquired anything to tear down.
   * @throws {FailedToEndNativeAdapterError} If the payment adapter fails to end
   */
  async end() {
    if (!this.enabled) {
      return;
    }

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
   * Returns true if the voidhash client is initialized. Always false while the
   * client is disabled.
   */
  get isInitialized() {
    return this._isInitialized;
  }

  /**
   * Whether this client does anything at all. Fixed at construction through
   * the `enabled` option; a disabled client no-ops every method.
   */
  get isEnabled() {
    return this.enabled;
  }

  /**
   * Whether the SDK currently runs in observer ("read-only") mode. Reflects
   * the latest {@link VoidhashClient.setReadOnly} call.
   */
  get isReadOnly() {
    return this.sdkConfiguration.isReadOnly();
  }

  /**
   * Switches observer mode at runtime, so an app migrating onto Voidhash can
   * flip from watching another SDK's purchases to owning them without
   * recreating the client (which would drop the native store connection, the
   * caches and the analytics queue).
   *
   * Takes effect at the next decision point of each JS-side consumer:
   * - `purchase()` / `setPersonAttributesSync()` gating,
   * - the transaction observer's finish/acknowledge decision for transactions
   *   it processes after this call,
   * - the `x-observer-mode` header of subsequent requests.
   *
   * A purchase that already started keeps the mode it started with: switching
   * to observer mode mid-purchase must not leave that transaction unfinished
   * with the store. Store transactions already being processed when the call
   * lands may also complete under the previous mode.
   *
   * No-ops in effect on a disabled client — it never processes transactions.
   */
  setReadOnly(readOnly: boolean) {
    this.sdkConfiguration.setReadOnly(readOnly);
  }

  /**
   * Returns currently identified person. Returns `null` while disabled.
   */
  async getCurrentPerson(forceFetch = false) {
    if (!this.enabled) {
      return null;
    }

    this.ensureInitialized();
    return this.runEffect(
      this.initializedClient!.getCurrentPerson(forceFetch),
      "FAILED_TO_GET_CURRENT_PERSON",
    );
  }

  /**
   * Sets person attributes asynchronously. Reserved `email`/`name` keys map to
   * the dedicated server fields; any other key is forwarded as a custom trait.
   * The update rides the analytics queue (fire-and-forget) — call `flush()` if
   * you need it delivered promptly.
   */
  async setPersonAttributes(attributes: PersonAttributes) {
    if (!this.enabled) {
      return;
    }

    await this.runSideEffect("setPersonAttributes", async () => {
      this.ensureInitialized();
      await this.runEffect(
        this.initializedClient!.setPersonAttributes(attributes),
        "FAILED_TO_SET_PERSON_ATTRIBUTES",
      );
    });
  }

  /**
   * Sets person attributes synchronously and returns the updated person
   * snapshot. Performs a network round-trip, so this is a write — it is blocked
   * in read-only mode, mirroring `purchase`. Returns `null` while disabled.
   */
  async setPersonAttributesSync(attributes: PersonAttributes) {
    if (!this.enabled) {
      return null;
    }

    this.ensureInitialized();
    if (this.isReadOnly) {
      return Effect.runSync(Effect.die(new ReadOnlyModePurchaseNotAllowedError()));
    }

    return this.runEffect(
      this.initializedClient!.setPersonAttributesSync(attributes),
      "FAILED_TO_SET_PERSON_ATTRIBUTES_SYNC",
    );
  }

  /** Returns the current distinct id, or `null` while disabled. */
  async getDistinctId() {
    if (!this.enabled) {
      return null;
    }

    this.ensureInitialized();
    return this.runEffect(this.initializedClient!.getDistinctId(), "FAILED_TO_GET_DISTINCT_ID");
  }

  /**
   * Identifies the user by switching the current distinct id.
   */
  async identify(
    externalUserId: string,
    options: {
      email?: string;
      name?: string;
    },
  ) {
    if (!this.enabled) {
      return;
    }

    await this.runSideEffect("identify", async () => {
      this.ensureInitialized();
      await this.runEffect(
        this.initializedClient!.identify(externalUserId, options),
        "FAILED_TO_IDENTIFY",
      );
    });
  }

  /**
   * Resets the current identity to a fresh anonymous distinct id.
   */
  async reset() {
    if (!this.enabled) {
      return;
    }

    await this.runSideEffect("reset", async () => {
      this.ensureInitialized();
      await this.runEffect(this.initializedClient!.reset(), "FAILED_TO_RESET");
    });
  }

  /**
   * Signs the current user out: captures the built-in `$sign_out` event,
   * flushes it under the signing-out identity, then resets to a fresh
   * anonymous distinct id.
   */
  async signOut() {
    if (!this.enabled) {
      return;
    }

    await this.runSideEffect("signOut", async () => {
      this.ensureInitialized();
      await this.runEffect(this.initializedClient!.signOut(), "FAILED_TO_SIGN_OUT");
    });
  }

  /**
   * Returns feature flag evaluation results. Returns no flags while disabled.
   */
  async getFeatureFlags(flagKeys?: string[]) {
    if (!this.enabled) {
      return DISABLED_FEATURE_FLAGS;
    }

    this.ensureInitialized();
    return this.runEffect(
      this.initializedClient!.getFeatureFlags(flagKeys),
      "FAILED_TO_GET_FEATURE_FLAGS",
    );
  }

  /**
   * Resolves the currently assigned paywall showing for a location slug.
   * Resolves to `null` while disabled.
   */
  async getPaywallForLocation(locationSlug: LocationSlug) {
    if (!this.enabled) {
      return null;
    }

    this.ensureInitialized();
    return this.runEffect(
      this.initializedClient!.getPaywallForLocation(locationSlug),
      "FAILED_TO_GET_PAYWALL_FOR_LOCATION",
    );
  }

  /**
   * Builds the paywall-deploy contract §7.1 runtime config for a code-release
   * paywall (native store product metadata, variables passthrough, platform +
   * locale). Used by `usePaywallByLocation` to answer the bundle's `ready`
   * event with a `configure` envelope.
   */
  async internal_buildPaywallRuntimeConfig(runtime: PaywallReleaseRuntime) {
    if (!this.enabled) {
      return DISABLED_PAYWALL_RUNTIME_CONFIG;
    }

    this.ensureInitialized();
    return this.runEffect(
      this.initializedClient!.buildPaywallRuntimeConfig(runtime),
      "FAILED_TO_BUILD_PAYWALL_RUNTIME_CONFIG",
    );
  }

  /**
   * Returns products available on the current platform.
   * Keys are the project's product slugs (resolved via the generated
   * `voidhash.gen.d.ts`). Values are `null` when the underlying store SDK
   * doesn't know about that product. Returns no products while disabled.
   */
  async getProducts() {
    if (!this.enabled) {
      // A disabled client never talks to the store, so no slug resolves. The
      // cast mirrors `ProductService`'s own slug-keyed map construction.
      return {} as ProductsBySlug;
    }

    this.ensureInitialized();
    return this.runEffect(this.initializedClient!.getProducts(), "FAILED_TO_GET_PRODUCTS");
  }

  /**
   * Purchases a product. Blocked in observer mode — the check reads the mode
   * in effect when the purchase starts, so a `setReadOnly()` landing later
   * doesn't abandon it. No-ops while disabled.
   */
  async purchase(
    product: Product,
    _options: {
      method?: "native";
    },
  ) {
    if (!this.enabled) {
      return;
    }

    this.ensureInitialized();
    if (this.isReadOnly) {
      return Effect.runSync(Effect.die(new ReadOnlyModePurchaseNotAllowedError()));
    }

    await this.runEffect(this.initializedClient!.purchase(product, _options), "FAILED_TO_PURCHASE");
  }

  /**
   * Restores purchases by reconciling pending/past store transactions and
   * refreshing person state.
   */
  async restorePurchases() {
    if (!this.enabled) {
      return;
    }

    await this.runSideEffect("restorePurchases", async () => {
      this.ensureInitialized();
      await this.runEffect(
        this.initializedClient!.restorePurchases(),
        "FAILED_TO_RESTORE_PURCHASES",
      );
    });
  }

  /**
   * Captures a product analytics event.
   * Events are batched and delivered on size/time thresholds. Dropped — not
   * buffered — while disabled.
   */
  capture(eventName: string, properties: Record<string, unknown> = {}) {
    if (!this.enabled) {
      return;
    }

    if (!this.initializedClient) {
      const normalized = eventName.trim();
      if (normalized) {
        this.preInitAnalyticsBuffer.push({ eventName: normalized, properties });
      }
      return;
    }

    this.effectRuntime.runSync(this.initializedClient.capture(eventName, properties));
  }

  /**
   * Flushes queued analytics events. Nothing is ever queued while disabled, so
   * this no-ops.
   */
  async flush() {
    if (!this.enabled) {
      return;
    }

    await this.runSideEffect("flush", async () => {
      if (this.analyticsFlushInFlight) {
        await this.analyticsFlushInFlight;
        return;
      }

      if (!this.initializedClient) return;

      this.analyticsFlushInFlight = this.runEffect(
        this.initializedClient.flush(),
        "FAILED_TO_FLUSH_ANALYTICS",
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
    if (!this.enabled) {
      return;
    }

    await this.runSideEffect("iosPresentCodeRedemptionSheet", async () => {
      this.ensureInitialized();
      await this.runEffect(
        this.initializedClient!.iosPresentCodeRedemptionSheet(),
        "FAILED_TO_PRESENT_CODE_REDEMPTION_SHEET",
      );
    });
  }

  async iosShowManageSubscriptions() {
    if (!this.enabled) {
      return;
    }

    await this.runSideEffect("iosShowManageSubscriptions", async () => {
      this.ensureInitialized();
      await this.runEffect(
        this.initializedClient!.iosShowManageSubscriptions(),
        "FAILED_TO_SHOW_MANAGE_SUBSCRIPTIONS",
      );
    });
  }

  // ===============================
  // Internal helpers
  // ===============================

  internal_getAtomRegistry() {
    return this.atomRegistry;
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
      // This warning is intentionally surfaced in all environments.
      console.warn(`[voidhash] failed to ${operation}`, error);
    });
  }

  // Effect requires service type parameter
  private async runEffect<T>(
    effect: Effect.Effect<T, unknown, any>,
    errorCode: string,
  ): Promise<T> {
    const result = await this.effectRuntime.runPromiseExit(effect);
    if (Exit.isSuccess(result)) return result.value;
    return Effect.runSync(Effect.die(toErrorWithMessage(errorCode, Cause.squash(result.cause))));
  }

  private ensureInitialized() {
    if (!this.initializedClient) {
      return Effect.runSync(
        Effect.die(
          new VoidhashError(
            "VOIDHASH_CLIENT_NOT_INITIALIZED",
            new Error("ProductManager is not initialized"),
          ),
        ),
      );
    }
  }

  // ===============================
  // Person helpers
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
