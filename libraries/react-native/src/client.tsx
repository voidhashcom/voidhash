import { Result } from "better-result";
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
import { PurchasePendingError, UserCancelledError } from "./core/payment-adapters/errors";
import { findActiveGrant, type EntitlementGrant } from "./core/entitlements/find-grant";
import {
  engineApiClientLayer,
} from "./core/networking/engine-api-client";
import { type PaywallReleaseRuntime, PaywallService } from "./core/paywalls/paywall-service";
import type { PlatformInfo } from "./core/platform/platform-provider";
import { ReactNativePlatformProvider } from "./core/platform/react-native-platform-provider";
import { type ProductsBySlug, ProductService } from "./core/products/product-service";
import type { LocationSlug, PerkSlug, ProductSlug } from "./core/schema/registry";
import type { RuntimeSchema } from "./core/schema/runtime";
import { SchemaManager } from "./core/schema/schema-manager";
import {
  type SdkConfigurationHandle,
  SdkConfiguration,
  makeSdkConfiguration,
} from "./core/sdk-configuration";
import { TransactionService } from "./core/transactions/transaction-service";
import {
  type VoidhashErrorCode,
  NotInitializedError,
  ReadOnlyModePurchaseNotAllowedError,
  VoidhashError,
} from "./errors";
import type { PaywallRuntimeConfig } from "./internal/paywall-bridge/protocol";
import type { VoidhashEngine as VoidhashEngineSpec } from "./specs/VoidhashEngine.nitro";

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
  /**
   * Route all `/api/v1/sdk` traffic through the embedded native engine (the bare Swift /
   * Kotlin clients) instead of the TypeScript networking stack when this platform ships one.
   * Falls back to the TypeScript transport transparently wherever the native engine is not
   * available. Defaults to `false` until device-verified.
   */
  unstable_nativeEngine?: boolean;
}

const CreateEffectRuntime = (
  platform: PlatformInfo["platform"],
  developmentMode: boolean,
  atomRegistry: AtomRegistry.AtomRegistry,
  sdkConfiguration: typeof SdkConfiguration.Service,
  nativeEngine?: VoidhashEngineSpec,
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
  // The embedded native engine replaces the TypeScript networking stack when it exists:
  // headers and environment mode are then built natively, exactly like a pure-native app.
  const apiClientLayer =
    nativeEngine !== undefined ? engineApiClientLayer(nativeEngine) : ApiClient.Default;
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
      Layer.provideMerge(apiClientLayer),
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

/** Matches an Effect `Data.TaggedError` by tag without importing its class. */
const isTaggedError = (value: unknown, tag: string): boolean =>
  typeof value === "object" && value !== null && "_tag" in value && value._tag === tag;

const toErrorWithMessage = (code: VoidhashErrorCode, unknownCause: unknown) => {
  const cause = unknownCause instanceof Error ? unknownCause : new Error(String(unknownCause));

  return new VoidhashError(code, `${code}: ${cause.message}`, { cause });
};

/**
 * Successful outcome of a {@link VoidhashClient.purchase} call. The failure
 * channel is the `Err` of the returned `Result` — cancellation and deferral
 * are expected outcomes, not errors.
 *
 * - `completed`: the transaction was validated by Voidhash and the person
 *   snapshot has been refreshed.
 * - `cancelled`: the customer dismissed the native store sheet.
 * - `pending`: the purchase needs external action (e.g. approval) before it
 *   completes; access arrives once the transaction observer reconciles it.
 * - `disabled`: the client was created with `enabled: false`.
 */
export type PurchaseOutcome =
  | { status: "completed" }
  | { status: "cancelled" }
  | { status: "pending" }
  | { status: "disabled" };

/** Answer to an entitlement check for one perk. */
export interface HasPerkResult {
  /** The active grant behind `hasAccess`, or `null` when there is none. */
  grant: EntitlementGrant | null;
  hasAccess: boolean;
  /**
   * True when `hasAccess` was served from the cached snapshot because a
   * refresh failed (offline, server error). Only ever `true` together with
   * `hasAccess: true` and a non-null `grant`.
   */
  isStale: boolean;
}

type UninitializedEffectClient = ReturnType<typeof VoidhashEffectClient.makeUnitializedClient>;

// `makeInitializedClient` now returns `Effect<Facade, ...>` — unwrap to the
// facade type by extracting the Effect's Success channel.
type InitializedEffectClient = Effect.Success<
  ReturnType<typeof VoidhashEffectClient.makeInitializedClient>
>;

export class VoidhashClient {
  private _isInitialized = false;
  private analyticsFlushInFlight: Promise<Result<void, VoidhashError>> | null = null;
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
    nativeEngine?: VoidhashEngineSpec,
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
      nativeEngine,
    );
    this.unitializedClient = VoidhashEffectClient.makeUnitializedClient();
  }

  private async runSideEffect(
    operation: string,
    effect: () => Promise<Result<void, VoidhashError>>,
  ): Promise<Result<void, VoidhashError>> {
    const exit = await Effect.runPromiseExit(
      Effect.tryPromise({ try: () => effect(), catch: (error) => error }),
    );

    const result: Result<void, VoidhashError> = Exit.isSuccess(exit)
      ? exit.value
      : Result.err(toErrorWithMessage("UNKNOWN", Cause.squash(exit.cause)));

    if (result.isErr() && this.unstableSwallowErrors) {
      // This warning is intentionally surfaced in all environments.
      console.warn(`[voidhash] swallowed error in ${operation}`, result.error);
      return Result.ok(undefined);
    }

    return result;
  }

  /**
   * Initializes the voidhash client. Fetches the runtime schema from the
   * server (or uses the injected internal schema if one was provided for tests).
   * Resolves immediately without touching the store, the network or the
   * cache when the client was created with `enabled: false`.
   */
  async init(): Promise<Result<void, VoidhashError>> {
    if (!this.enabled) {
      return Result.ok(undefined);
    }

    return this.runSideEffect("init", async () => {
      const initializedClientResult = await this.toResult(
        this.unitializedClient.init({
          distinctId: this.initialDistinctId ?? undefined,
          internalSchema: this.internalSchema,
        }),
        "FAILED_TO_INITIALIZE_VOIDHASH_CLIENT",
      );
      if (initializedClientResult.isErr()) {
        return Result.err(initializedClientResult.error);
      }
      const initializedClient = initializedClientResult.value;

      const observerResult = await this.toResult(
        initializedClient.startTransactionObserver((transaction) => {
          void this.effectRuntime.runPromiseExit(
            initializedClient.processObservedTransaction(transaction),
          );
        }),
        "FAILED_TO_INITIALIZE_VOIDHASH_CLIENT",
      );
      if (observerResult.isErr()) {
        return Result.err(observerResult.error);
      }

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

      const startupEventsResult = await this.toResult(
        initializedClient.captureAutomaticStartupEvents(),
        "FAILED_TO_CAPTURE_STARTUP_EVENTS",
      );
      if (startupEventsResult.isErr()) {
        // This warning is intentionally surfaced in all environments.
        console.warn(
          "[voidhash] failed to capture automatic startup analytics",
          startupEventsResult.error,
        );
      }

      // Awaited rather than run synchronously: `LifecycleAdapter.subscribe` is
      // an Effect the adapter owns, and an asynchronous implementation would
      // die under `runSync` — failing `init()` long after the client was
      // marked initialized and leaving a half-live client behind.
      const lifecycleResult = await this.toResult(
        initializedClient.setupAutomaticLifecycleEvents((eventName) => {
          this.capture(eventName);
        }),
        "FAILED_TO_SETUP_LIFECYCLE_EVENTS",
      );
      if (lifecycleResult.isErr()) {
        return Result.err(lifecycleResult.error);
      }
      this.appLifecycleSubscription = lifecycleResult.value;

      this.triggerBackgroundFlush("flush analytics after init");
      return Result.ok(undefined);
    });
  }

  /**
   * Ends the voidhash client. No-ops on a disabled client, which never
   * acquired anything to tear down.
   */
  async end(): Promise<Result<void, VoidhashError>> {
    if (!this.enabled) {
      return Result.ok(undefined);
    }

    return this.runSideEffect("end", async () => {
      if (!this.initializedClient) {
        return Result.err(new NotInitializedError());
      }

      await this.flush();
      const endResult = await this.toResult(
        this.initializedClient.end(),
        "FAILED_TO_END_VOIDHASH_CLIENT",
      );
      if (endResult.isErr()) {
        return Result.err(endResult.error);
      }
      this.appLifecycleSubscription?.remove();
      this.appLifecycleSubscription = null;
      this._isInitialized = false;
      return Result.ok(undefined);
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
   * Returns the current person snapshot, or `null` before the first snapshot
   * exists. Serves a fresh cache entry when available
   * (stale-while-revalidate); pass `{ forceFetch: true }` to skip the cache.
   * Answers `Ok(null)` while disabled.
   */
  async getCurrentPerson(options: { forceFetch?: boolean } = {}) {
    if (!this.enabled) {
      return Result.ok(null);
    }

    if (!this.initializedClient) {
      return Result.err(new NotInitializedError());
    }
    return this.toResult(
      this.initializedClient.getCurrentPerson(options.forceFetch ?? false),
      "FAILED_TO_GET_CURRENT_PERSON",
    );
  }

  /**
   * Checks whether the current person holds an active grant for a perk.
   *
   * Refreshes the person snapshot first; if that fails (offline, server
   * error) the answer falls back to the cached snapshot and `isStale` is set,
   * so apps fail open with known-good data instead of silently denying
   * access. Pass `{ allowStale: false }` to fail with the refresh error
   * instead.
   */
  async hasPerk(
    perkSlug: PerkSlug,
    options: { allowStale?: boolean } = {},
  ): Promise<Result<HasPerkResult, VoidhashError>> {
    if (!this.enabled) {
      return Result.ok({ grant: null, hasAccess: false, isStale: false });
    }

    if (!this.initializedClient) {
      return Result.err(new NotInitializedError());
    }

    const refreshResult = await this.toResult(
      this.initializedClient.getCurrentPerson(true),
      "FAILED_TO_GET_CURRENT_PERSON",
    );

    if (refreshResult.isOk()) {
      const grant = findActiveGrant(refreshResult.value, perkSlug);
      return Result.ok({ grant, hasAccess: grant !== null, isStale: false });
    }

    const refreshError = refreshResult.error;
    if (options.allowStale === false) {
      return Result.err(refreshError);
    }

    const cachedResult = await this.toResult(
      this.initializedClient.getCachedPerson(),
      "FAILED_TO_GET_CURRENT_PERSON",
    );
    const grant = findActiveGrant(cachedResult.isOk() ? cachedResult.value : null, perkSlug);
    if (grant === null) {
      // No cached evidence of access — surface the refresh failure rather
      // than answering a confident "no" from nothing.
      return Result.err(refreshError);
    }
    return Result.ok({ grant, hasAccess: true, isStale: true });
  }

  /**
   * Sets person attributes asynchronously. Reserved `email`/`name` keys map to
   * the dedicated server fields; any other key is forwarded as a custom trait.
   * The update rides the analytics queue (fire-and-forget) — call `flush()` if
   * you need it delivered promptly.
   */
  async setPersonAttributes(attributes: PersonAttributes): Promise<Result<void, VoidhashError>> {
    if (!this.enabled) {
      return Result.ok(undefined);
    }

    return this.runSideEffect("setPersonAttributes", async () => {
      if (!this.initializedClient) {
        return Result.err(new NotInitializedError());
      }
      return this.toResult(
        this.initializedClient.setPersonAttributes(attributes),
        "FAILED_TO_SET_PERSON_ATTRIBUTES",
      );
    });
  }

  /**
   * Sets person attributes synchronously and returns the updated person
   * snapshot. Performs a network round-trip, so this is a write — it is blocked
   * in read-only mode, mirroring `purchase`. Answers `Ok(null)` while disabled.
   */
  async setPersonAttributesSync(attributes: PersonAttributes) {
    if (!this.enabled) {
      return Result.ok(null);
    }

    if (!this.initializedClient) {
      return Result.err(new NotInitializedError());
    }
    if (this.isReadOnly) {
      return Result.err(new ReadOnlyModePurchaseNotAllowedError());
    }

    return this.toResult(
      this.initializedClient.setPersonAttributesSync(attributes),
      "FAILED_TO_SET_PERSON_ATTRIBUTES_SYNC",
    );
  }

  /** Returns the current distinct id, or `Ok(null)` while disabled. */
  async getDistinctId() {
    if (!this.enabled) {
      return Result.ok(null);
    }

    if (!this.initializedClient) {
      return Result.err(new NotInitializedError());
    }
    return this.toResult(this.initializedClient.getDistinctId(), "FAILED_TO_GET_DISTINCT_ID");
  }

  /**
   * Identifies the user by switching the current distinct id.
   */
  async identify(
    externalUserId: string,
    options: {
      email?: string;
      name?: string;
    } = {},
  ): Promise<Result<void, VoidhashError>> {
    if (!this.enabled) {
      return Result.ok(undefined);
    }

    return this.runSideEffect("identify", async () => {
      if (!this.initializedClient) {
        return Result.err(new NotInitializedError());
      }
      return this.toResult(
        this.initializedClient.identify(externalUserId, options),
        "FAILED_TO_IDENTIFY",
      );
    });
  }

  /**
   * Resets the current identity to a fresh anonymous distinct id.
   */
  async reset(): Promise<Result<void, VoidhashError>> {
    if (!this.enabled) {
      return Result.ok(undefined);
    }

    return this.runSideEffect("reset", async () => {
      if (!this.initializedClient) {
        return Result.err(new NotInitializedError());
      }
      return this.toResult(this.initializedClient.reset(), "FAILED_TO_RESET");
    });
  }

  /**
   * Signs the current user out: captures the built-in `$sign_out` event,
   * flushes it under the signing-out identity, then resets to a fresh
   * anonymous distinct id.
   */
  async signOut(): Promise<Result<void, VoidhashError>> {
    if (!this.enabled) {
      return Result.ok(undefined);
    }

    return this.runSideEffect("signOut", async () => {
      if (!this.initializedClient) {
        return Result.err(new NotInitializedError());
      }
      return this.toResult(this.initializedClient.signOut(), "FAILED_TO_SIGN_OUT");
    });
  }

  /**
   * Returns feature flag evaluation results. Returns no flags while disabled.
   */
  async getFeatureFlags(flagKeys?: string[]) {
    if (!this.enabled) {
      return Result.ok(DISABLED_FEATURE_FLAGS);
    }

    if (!this.initializedClient) {
      return Result.err(new NotInitializedError());
    }
    return this.toResult(
      this.initializedClient.getFeatureFlags(flagKeys),
      "FAILED_TO_GET_FEATURE_FLAGS",
    );
  }

  /**
   * Resolves the currently assigned paywall showing for a location slug.
   * Answers `Ok(null)` while disabled.
   */
  async getPaywallForLocation(locationSlug: LocationSlug) {
    if (!this.enabled) {
      return Result.ok(null);
    }

    if (!this.initializedClient) {
      return Result.err(new NotInitializedError());
    }
    return this.toResult(
      this.initializedClient.getPaywallForLocation(locationSlug),
      "FAILED_TO_GET_PAYWALL_FOR_LOCATION",
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
      return Result.ok({} as ProductsBySlug);
    }

    if (!this.initializedClient) {
      return Result.err(new NotInitializedError());
    }
    return this.toResult(this.initializedClient.getProducts(), "FAILED_TO_GET_PRODUCTS");
  }

  /**
   * Purchases a product. Blocked in observer mode — the check reads the mode
   * in effect when the purchase starts, so a `setReadOnly()` landing later
   * doesn't abandon it. Resolves to a `Result`; cancellation and deferral are
   * `Ok` outcomes, every failure is an `Err` carrying a coded
   * {@link VoidhashError}. Answers `Ok({ status: "disabled" })` while disabled.
   */
  async purchase(product: Product): Promise<Result<PurchaseOutcome, VoidhashError>> {
    if (!this.enabled) {
      return Result.ok({ status: "disabled" });
    }

    if (!this.initializedClient) {
      return Result.err(new NotInitializedError());
    }
    if (this.isReadOnly) {
      return Result.err(new ReadOnlyModePurchaseNotAllowedError());
    }

    const exit = await this.effectRuntime.runPromiseExit(this.initializedClient.purchase(product));
    if (Exit.isSuccess(exit)) {
      return Result.ok({ status: "completed" });
    }

    const cause = Cause.squash(exit.cause);
    if (cause instanceof UserCancelledError || isTaggedError(cause, "UserCancelledError")) {
      return Result.ok({ status: "cancelled" });
    }
    if (cause instanceof PurchasePendingError || isTaggedError(cause, "PurchasePendingError")) {
      return Result.ok({ status: "pending" });
    }
    return Result.err(toErrorWithMessage("FAILED_TO_PURCHASE", cause));
  }

  /**
   * Restores purchases by reconciling pending/past store transactions and
   * refreshing person state.
   */
  async restorePurchases(): Promise<Result<void, VoidhashError>> {
    if (!this.enabled) {
      return Result.ok(undefined);
    }

    return this.runSideEffect("restorePurchases", async () => {
      if (!this.initializedClient) {
        return Result.err(new NotInitializedError());
      }
      return this.toResult(
        this.initializedClient.restorePurchases(),
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
  async flush(): Promise<Result<void, VoidhashError>> {
    if (!this.enabled) {
      return Result.ok(undefined);
    }

    return this.runSideEffect("flush", async () => {
      if (this.analyticsFlushInFlight) {
        await this.analyticsFlushInFlight;
        return Result.ok(undefined);
      }

      if (!this.initializedClient) {
        return Result.ok(undefined);
      }

      const inFlight = this.toResult(
        this.initializedClient.flush(),
        "FAILED_TO_FLUSH_ANALYTICS",
      ).finally(() => {
        this.analyticsFlushInFlight = null;
      });
      this.analyticsFlushInFlight = inFlight;

      return inFlight;
    });
  }

  // ===============================
  // IOS only methods
  // ===============================

  async iosPresentCodeRedemptionSheet(): Promise<Result<void, VoidhashError>> {
    if (!this.enabled) {
      return Result.ok(undefined);
    }

    return this.runSideEffect("iosPresentCodeRedemptionSheet", async () => {
      if (!this.initializedClient) {
        return Result.err(new NotInitializedError());
      }
      return this.toResult(
        this.initializedClient.iosPresentCodeRedemptionSheet(),
        "FAILED_TO_PRESENT_CODE_REDEMPTION_SHEET",
      );
    });
  }

  async iosShowManageSubscriptions(): Promise<Result<void, VoidhashError>> {
    if (!this.enabled) {
      return Result.ok(undefined);
    }

    return this.runSideEffect("iosShowManageSubscriptions", async () => {
      if (!this.initializedClient) {
        return Result.err(new NotInitializedError());
      }
      return this.toResult(
        this.initializedClient.iosShowManageSubscriptions(),
        "FAILED_TO_SHOW_MANAGE_SUBSCRIPTIONS",
      );
    });
  }

  // ===============================
  // Internal helpers
  // ===============================

  /**
   * Internal surface used by the SDK's React bindings and paywall bridge.
   * Not part of the public API — may change or disappear at any time.
   */
  readonly internal = {
    getAtomRegistry: () => this.atomRegistry,
    getSchema: (): RuntimeSchema | null => this.initializedClient?.getSchema() ?? null,
    getSuccessCallbackBaseUrl: () => `${this.scheme}://voidhash/callback/success`,
    getErrorCallbackBaseUrl: () => `${this.scheme}://voidhash/callback/error`,
    buildPaywallRuntimeConfig: (runtime: PaywallReleaseRuntime) =>
      this.buildPaywallRuntimeConfig(runtime),
  };

  /**
   * Builds the paywall-deploy contract §7.1 runtime config for a code-release
   * paywall (native store product metadata, variables passthrough, platform +
   * locale). Used by `usePaywallByLocation` to answer the bundle's `ready`
   * event with a `configure` envelope.
   */
  private async buildPaywallRuntimeConfig(runtime: PaywallReleaseRuntime) {
    if (!this.enabled) {
      return Result.ok(DISABLED_PAYWALL_RUNTIME_CONFIG);
    }

    if (!this.initializedClient) {
      return Result.err(new NotInitializedError());
    }
    return this.toResult(
      this.initializedClient.buildPaywallRuntimeConfig(runtime),
      "FAILED_TO_BUILD_PAYWALL_RUNTIME_CONFIG",
    );
  }

  private triggerBackgroundFlush(operation: string) {
    void this.flush().then((result) => {
      if (result.isErr()) {
        // This warning is intentionally surfaced in all environments.
        console.warn(`[voidhash] failed to ${operation}`, result.error);
      }
    });
  }

  /** Runs an Effect to completion, mapping every failure to a coded `VoidhashError`. */
  private async toResult<T>(
    effect: Effect.Effect<T, unknown, any>,
    errorCode: VoidhashErrorCode,
  ): Promise<Result<T, VoidhashError>> {
    const exit = await this.effectRuntime.runPromiseExit(effect);
    if (Exit.isSuccess(exit)) return Result.ok(exit.value);
    return Result.err(toErrorWithMessage(errorCode, Cause.squash(exit.cause)));
  }

  // ===============================
  // Person helpers
  // ===============================

  /** Clears the cached person snapshot. The next read refetches from the server. */
  async resetCache(): Promise<Result<void, VoidhashError>> {
    if (!this.enabled) {
      return Result.ok(undefined);
    }

    return this.runSideEffect("resetCache", async () => {
      if (!this.initializedClient) {
        return Result.err(new NotInitializedError());
      }
      return this.toResult(
        this.initializedClient.resetPersonCache(),
        "FAILED_TO_RESET_PERSON_CACHE",
      );
    });
  }
}

/** Convenience re-export to keep `ProductSlug` reachable from this module. */
export type { ProductSlug };
