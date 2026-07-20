import { Cause, type Effect, Exit, Layer, ManagedRuntime, pipe } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { AtomRegistry } from "effect/unstable/reactivity";

import { VoidhashEffectClient } from "./client-effect";
import { AnalyticsService } from "./core/analytics/service";
import { AsyncStorageCacheAdapter } from "./core/caching/async-storage-cache";
import { CacheManager } from "./core/caching/cache-manager";
import type { Product } from "./core/entities/product";
import { FeatureFlagService } from "./core/feature-flags/feature-flag-service";
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
import { type PaywallReleaseRuntime, PaywallService } from "./core/paywalls/paywall-service";
import type { PlatformInfo } from "./core/platform/platform-provider";
import { ReactNativePlatformProvider } from "./core/platform/react-native-platform-provider";
import { ProductService } from "./core/products/product-service";
import type { LocationSlug, ProductSlug } from "./core/schema/registry";
import type { RuntimeSchema } from "./core/schema/runtime";
import { SchemaManager } from "./core/schema/schema-manager";
import { SdkConfiguration } from "./core/sdk-configuration";
import { TransactionService } from "./core/transactions/transaction-service";
import {
  type ConsentClient,
  type ConsentSnapshot,
  type LinkConfiguration,
  type LinksClient,
  type MeasurementClient,
  type MeasurementConfiguration,
  type NotificationsClient,
  type NotificationsConfiguration,
  UnifiedMeasurementRuntime,
  type MeasurementRuntimeAdapter,
  type MeasurementEndpointOverrides,
  type ResolvedMeasurementEndpoints,
  type ProtectedIdentityTraits,
  type ProtectedIdentityUpdateResult,
} from "./core/measurement";
import { ReadOnlyModePurchaseNotAllowedError, VoidhashError } from "./errors";

export interface VoidhashClientOptions {
  baseUrl?: string;
  debug?: boolean;
  distinctId?: string;
  ingestUrl?: string;
  /** Self-host endpoint and signed-configuration trust overrides. */
  endpoints?: MeasurementEndpointOverrides;
  /** Initial revisioned consent state loaded before optional collectors run. */
  consent?: ConsentSnapshot;
  /** Unified measurement and collection configuration. */
  measurement?: MeasurementConfiguration;
  /** Deep-link normalization, allowlisting, and payload configuration. */
  links?: LinkConfiguration;
  /** Push permission and registration behavior. */
  notifications?: NotificationsConfiguration;
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
  atomRegistry: AtomRegistry.AtomRegistry,
  measurementRuntime: UnifiedMeasurementRuntime,
) =>
  ManagedRuntime.make(
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
      Layer.provideMerge(platform === "ios" ? AppStoreAdapter : GooglePlayAdapter),
      Layer.provideMerge(Layer.succeed(AtomRegistry.AtomRegistry, atomRegistry)),
      Layer.provideMerge(ReactNativePlatformProvider),
      Layer.provideMerge(
        Layer.succeed(SdkConfiguration, {
          baseUrl,
          debug,
          ingestUrl,
          publishableKey,
          readOnly,
          measurementRuntime,
        }),
      ),
    ),
  );

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
  /** Measurement lifecycle, evidence, revenue, validation, and diagnostics. */
  readonly measurement: MeasurementClient;
  /** The single deep-link handling and result stream. */
  readonly links: LinksClient;
  /** The single revisioned consent input shared by every namespace. */
  readonly consent: ConsentClient;
  /** Push permission, registration, badge, and notification streams. */
  readonly notifications: NotificationsClient;

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
  private atomRegistry: AtomRegistry.AtomRegistry;

  private effectRuntime: ReturnType<typeof CreateEffectRuntime>;

  private unitializedClient: UninitializedEffectClient;
  private initializedClient?: InitializedEffectClient;
  private readonly measurementRuntime: UnifiedMeasurementRuntime;

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
    unifiedOptions: Pick<
      VoidhashClientOptions,
      "consent" | "measurement" | "links" | "notifications" | "endpoints"
    > & { readonly nativeAdapter?: MeasurementRuntimeAdapter } = {},
    resolvedEndpoints?: ResolvedMeasurementEndpoints,
  ) {
    this.initialDistinctId = initialDistinctId;
    this.readOnly = readOnly;
    this.scheme = scheme;
    this.internalSchema = internalSchema;
    this.unstableSwallowErrors = unstableSwallowErrors;
    this.atomRegistry = atomRegistry;
    this.measurementRuntime = new UnifiedMeasurementRuntime({
      publishableKey,
      baseUrl,
      ingestUrl,
      platform,
      distinctId: initialDistinctId ?? undefined,
      consent: unifiedOptions.consent,
      measurement: unifiedOptions.measurement,
      links: unifiedOptions.links,
      notifications: unifiedOptions.notifications,
      adapter: unifiedOptions.nativeAdapter,
      linksUrl: resolvedEndpoints?.links,
      trustedConfigKeyIds: resolvedEndpoints?.trustedConfigKeyIds,
      trustedConfigKeys: unifiedOptions.endpoints?.trustedConfigKeys?.map((key) => ({
        keyId: key.keyId,
        publicKeySpki: key.publicKey,
      })),
      configurationProjectId: unifiedOptions.endpoints?.configurationProjectId,
    });
    this.effectRuntime = CreateEffectRuntime(
      platform,
      baseUrl,
      debug,
      ingestUrl,
      publishableKey,
      readOnly,
      atomRegistry,
      this.measurementRuntime,
    );
    this.unitializedClient = VoidhashEffectClient.makeUnitializedClient();
    this.measurement = this.measurementRuntime.measurement;
    this.links = this.measurementRuntime.links;
    this.consent = this.measurementRuntime.consent;
    this.notifications = this.measurementRuntime.notifications;
  }

  private async runSideEffect<T>(operation: string, effect: () => Promise<T>): Promise<T | undefined> {
    try {
      return await effect();
    } catch (error) {
      if (!this.unstableSwallowErrors) {
        throw error;
      }

      // biome-ignore lint/suspicious/noConsole: This warning is intentionally surfaced in all environments.
      console.warn(`[voidhash] swallowed error in ${operation}`, error);
      return undefined;
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
      const initializedDistinctId = await this.runEffect(
        initializedClient.getDistinctId(),
        "FAILED_TO_GET_DISTINCT_ID",
      );
      this.measurementRuntime.internalHydrateIdentity(initializedDistinctId);
      await this.measurementRuntime.initialize();

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
        // biome-ignore lint/suspicious/noConsole: This warning is intentionally surfaced in all environments.
        console.warn("[voidhash] failed to capture automatic startup analytics", error);
      });

      this.appLifecycleSubscription = this.effectRuntime.runSync(
        initializedClient.setupAutomaticLifecycleEvents((eventName) => {
          this.capture(eventName);
        }),
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
   * Returns currently identified person.
   */
  async getCurrentPerson(forceFetch = false) {
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
   * in read-only mode, mirroring `purchase`.
   */
  async setPersonAttributesSync(attributes: PersonAttributes) {
    this.ensureInitialized();
    if (this.readOnly) {
      throw new ReadOnlyModePurchaseNotAllowedError();
    }

    return this.runEffect(
      this.initializedClient!.setPersonAttributesSync(attributes),
      "FAILED_TO_SET_PERSON_ATTRIBUTES_SYNC",
    );
  }

  async getDistinctId() {
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
      emails?: ProtectedIdentityTraits["emails"];
      phones?: ProtectedIdentityTraits["phones"];
      clearEmails?: boolean;
      clearPhones?: boolean;
    } = {},
  ): Promise<ProtectedIdentityUpdateResult | undefined> {
    return this.runSideEffect("identify", async () => {
      this.ensureInitialized();
      await this.runEffect(
        this.initializedClient!.identify(externalUserId, options),
        "FAILED_TO_IDENTIFY",
      );
      this.measurementRuntime.setIdentity(externalUserId);
      if (options.emails || options.phones || options.clearEmails || options.clearPhones) {
        return this.measurementRuntime.setProtectedIdentityTraits({
          emails: options.emails,
          phones: options.phones,
          clearEmails: options.clearEmails,
          clearPhones: options.clearPhones,
        });
      }
      return undefined;
    });
  }

  /**
   * Resets the current identity to a fresh anonymous distinct id.
   */
  async reset() {
    await this.runSideEffect("reset", async () => {
      this.ensureInitialized();
      await this.runEffect(this.initializedClient!.reset(), "FAILED_TO_RESET");
      const distinctId = await this.runEffect(
        this.initializedClient!.getDistinctId(),
        "FAILED_TO_GET_DISTINCT_ID",
      );
      this.measurementRuntime.setIdentity(distinctId);
    });
  }

  /**
   * Signs the current user out: captures the built-in `$sign_out` event,
   * flushes it under the signing-out identity, then resets to a fresh
   * anonymous distinct id.
   */
  async signOut() {
    await this.runSideEffect("signOut", async () => {
      this.ensureInitialized();
      await this.runEffect(this.initializedClient!.signOut(), "FAILED_TO_SIGN_OUT");
      const distinctId = await this.runEffect(
        this.initializedClient!.getDistinctId(),
        "FAILED_TO_GET_DISTINCT_ID",
      );
      this.measurementRuntime.setIdentity(distinctId);
    });
  }

  /**
   * Returns feature flag evaluation results.
   */
  async getFeatureFlags(flagKeys?: string[]) {
    this.ensureInitialized();
    return this.runEffect(
      this.initializedClient!.getFeatureFlags(flagKeys),
      "FAILED_TO_GET_FEATURE_FLAGS",
    );
  }

  /**
   * Resolves the currently assigned paywall showing for a location slug.
   */
  async getPaywallForLocation(locationSlug: LocationSlug) {
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
   * doesn't know about that product.
   */
  async getProducts() {
    this.ensureInitialized();
    return this.runEffect(this.initializedClient!.getProducts(), "FAILED_TO_GET_PRODUCTS");
  }

  /**
   * Purchases a product.
   */
  async purchase(
    product: Product,
    _options: {
      method?: "native";
    },
  ) {
    this.ensureInitialized();
    if (this.readOnly) {
      throw new ReadOnlyModePurchaseNotAllowedError();
    }

    await this.runEffect(this.initializedClient!.purchase(product, _options), "FAILED_TO_PURCHASE");
  }

  /**
   * Restores purchases by reconciling pending/past store transactions and
   * refreshing person state.
   */
  async restorePurchases() {
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
   * Events are batched and delivered on size/time thresholds.
   */
  capture(eventName: string, properties: Record<string, unknown> = {}) {
    this.measurementRuntime.capture(eventName, properties);
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
        "FAILED_TO_FLUSH_ANALYTICS",
      ).finally(() => {
        this.analyticsFlushInFlight = null;
      });

      await this.analyticsFlushInFlight;
      await this.measurementRuntime.flush();
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
        "FAILED_TO_PRESENT_CODE_REDEMPTION_SHEET",
      );
    });
  }

  async iosShowManageSubscriptions() {
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
      // biome-ignore lint/suspicious/noConsole: This warning is intentionally surfaced in all environments.
      console.warn(`[voidhash] failed to ${operation}`, error);
    });
  }

  // biome-ignore lint/suspicious/noExplicitAny: Effect requires service type parameter
  private async runEffect<T>(
    effect: Effect.Effect<T, unknown, any>,
    errorCode: string,
  ): Promise<T> {
    const result = await this.effectRuntime.runPromiseExit(effect);
    if (Exit.isSuccess(result)) return result.value;
    throw toErrorWithMessage(errorCode, Cause.squash(result.cause));
  }

  private ensureInitialized() {
    if (!this.initializedClient) {
      throw new VoidhashError(
        "VOIDHASH_CLIENT_NOT_INITIALIZED",
        new Error("ProductManager is not initialized"),
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
