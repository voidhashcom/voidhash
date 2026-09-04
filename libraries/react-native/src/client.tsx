import * as P from "effect/Predicate";
import { Result } from "better-result";
import * as Arr from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as EffectRuntime from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Option from "effect/Option";
import * as R from "effect/Record";
import { pipe } from "effect/Function";
import { FetchHttpClient } from "effect/unstable/http";
import { AtomRegistry } from "effect/unstable/reactivity";

import { VoidhashEffectClient } from "./client-effect";
import { AUTOMATIC_EVENTS } from "./core/analytics/constants";
import { AnalyticsService } from "./core/analytics/service";
import { AnalyticsSessionManager } from "./core/analytics/session-manager";
import { NativeStorageCacheAdapter } from "./core/caching/native-storage-cache";
import { CacheManager } from "./core/caching/cache-manager";
import {
  type VoidhashDiagnostic,
  type VoidhashDiagnosticHandler,
  Diagnostics,
  makeDiagnosticsLayer,
} from "./core/diagnostics/diagnostics";
import { AuthGate } from "./core/network/auth-gate";
import { CircuitBreaker } from "./core/network/circuit-breaker";
import {
  type ConnectivityPort,
  Connectivity,
  makeConnectivityLayer,
} from "./core/network/connectivity";
import { SingleFlight } from "./core/network/single-flight";
import { TransactionOutbox } from "./core/transactions/transaction-outbox";
import type { SdkPerson } from "@voidhash/generated-clients";
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
import { IdentityEpoch } from "./core/identity/identity-epoch";
import { IdentityManager } from "./core/identity/identity-manager";
import { LifecycleService } from "./core/lifecycle/lifecycle-service";
import { ReactNativeLifecycleAdapter } from "./core/lifecycle/react-native-lifecycle-adapter";
import { ApiClient } from "./core/networking/api-client";
import { AppStoreAdapter } from "./core/payment-adapters/app-store-adapter";
import { DevelopmentPaymentAdapter } from "./core/payment-adapters/development-payment-adapter";
import { GooglePlayAdapter } from "./core/payment-adapters/google-play-adapter";
import { PaymentAdapter } from "./core/payment-adapters/payment-adapter";
import { PurchasePendingError, UserCancelledError } from "./core/payment-adapters/errors";
import type { EntitlementGrant } from "./core/entitlements/find-grant";
import { engineApiClientLayer } from "./core/networking/engine-api-client";
import { type PaywallReleaseRuntime, PaywallService } from "./core/paywalls/paywall-service";
import type { PlatformInfo } from "./core/platform/platform-provider";
import { ReactNativePlatformProvider } from "./core/platform/react-native-platform-provider";
import { type ProductsBySlug, ProductService } from "./core/products/product-service";
import type { LocationSlug, PerkSlug, ProductSlug } from "./core/schema/registry";
import type { RuntimeSchema } from "./core/schema/runtime";
import { SchemaManager } from "./core/schema/schema-manager";
import {
  type ScreenTracker,
  type ScreenView,
  createScreenTracker,
} from "./core/screens/screen-tracker";
import {
  type SdkConfigurationHandle,
  SdkConfiguration,
  makeSdkConfiguration,
} from "./core/sdk-configuration";
import { TransactionService } from "./core/transactions/transaction-service";
import { COMMERCE_FEATURES_ENABLED } from "./core/constants";
import {
  type VoidhashErrorCode,
  NotInitializedError,
  ReadOnlyModePurchaseNotAllowedError,
  VoidhashError,
} from "./errors";
import type { PaywallRuntimeConfig } from "./internal/paywall-bridge/protocol";
import type { VoidhashEngine as VoidhashEngineSpec } from "./specs/VoidhashEngine.nitro";
import * as Schema from "effect/Schema";
const effectEncodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);

/** Controls the built-in `$screen` event. */
export interface ScreenTrackingOptions {
  /** Default `true`. `false` makes every integration and `screen()` a no-op. */
  enabled?: boolean;
  /** Default `false`. Adds `$screen_params` (route params, string-coerced, max 20 keys). */
  includeParams?: boolean;
  /** Rewrites or drops a screen before capture. Return `null` to skip it. */
  // oxlint-disable-next-line effect/prefer-option-over-null -- public SDK option consumed by non-Effect app code; `null` is the documented "drop this screen" answer and mirrors the iOS and Android SDKs.
  mapScreen?: (view: ScreenView) => ScreenView | null;
}

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
   * Optional reachability source. React Native has no built-in one and the SDK
   * adds no native dependency, so apps that already depend on a reachability
   * library can hand its state in here: the SDK then flushes its queues and
   * refreshes stale state the moment the device comes back online. Without it
   * the SDK still recovers on its own, one probe at a time.
   */
  connectivity?: ConnectivityPort;
  /**
   * Called for every non-fatal event the SDK handled itself — a request that
   * failed and will be retried, an event evicted from a full queue, a rejected
   * publishable key. Purely informational; exceptions thrown here are
   * swallowed. Prefer this over `unstable_swallowErrors`.
   */
  onDiagnostic?: VoidhashDiagnosticHandler;
  /**
   * Placements to warm at boot so their first `show()` renders without a round
   * trip. Placements the device has already resolved are preloaded anyway.
   */
  preloadPlacements?: string[];
  /**
   * Starts the SDK in observer mode: transactions are reported to Voidhash but
   * never finished/acknowledged with the store, and purchases are blocked.
   * Commerce is temporarily unavailable, so the current release always runs
   * in this mode even when `false` is provided.
   */
  readOnly?: boolean;
  scheme?: string;
  /**
   * Automatic screen tracking (`$screen`). On by default; the Expo Router and
   * React Navigation integrations under `@voidhash/react-native/expo-router`
   * and `@voidhash/react-native/react-navigation` feed it, as does
   * `client.screen()`.
   */
  screenTracking?: ScreenTrackingOptions;
  /**
   * @deprecated Transport failures no longer surface as errors, so there is
   * nothing left for this to swallow. Use `onDiagnostic` to observe recovered
   * failures instead. Removed in a future release.
   */
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
  diagnosticsLayer: Layer.Layer<Diagnostics>,
  connectivityLayer: Layer.Layer<Connectivity>,
  nativeEngine?: VoidhashEngineSpec,
) => {
  const paymentAdapterLayer: Layer.Layer<PaymentAdapter> =
    __DEV__ && developmentMode
      ? DevelopmentPaymentAdapter
      : platform === "ios"
        ? AppStoreAdapter
        : GooglePlayAdapter;
  // The embedded native engine replaces the TypeScript networking stack when it exists:
  // headers and environment mode are then built natively, exactly like a pure-native app.
  const apiClientLayer =
    nativeEngine !== undefined ? engineApiClientLayer(nativeEngine) : ApiClient.Default;
  // Split in two because `pipe` accepts at most 20 arguments: the base half
  // carries the infrastructure services, the feature half the SDK services.
  const infrastructureLayer = pipe(
    CacheManager.Default,
    Layer.provideMerge(NativeStorageCacheAdapter),
    Layer.provideMerge(IdentityEpoch.layer),
    Layer.provideMerge(CircuitBreaker.layer),
    Layer.provideMerge(AuthGate.layer),
    Layer.provideMerge(SingleFlight.layer),
    Layer.provideMerge(connectivityLayer),
    Layer.provideMerge(diagnosticsLayer),
    Layer.provideMerge(apiClientLayer),
    Layer.provideMerge(FetchHttpClient.layer),
    Layer.provideMerge(paymentAdapterLayer),
    Layer.provideMerge(Layer.succeed(AtomRegistry.AtomRegistry, atomRegistry)),
    Layer.provideMerge(ReactNativePlatformProvider),
    Layer.provideMerge(Layer.succeed(SdkConfiguration, sdkConfiguration)),
  );

  return ManagedRuntime.make(
    pipe(
      PersonAttributeManager.Default,
      Layer.provideMerge(ProductService.layer),
      Layer.provideMerge(FeatureFlagService.layer),
      Layer.provideMerge(PaywallService.layer),
      Layer.provideMerge(TransactionService.layer),
      Layer.provideMerge(TransactionOutbox.layer),
      Layer.provideMerge(AnalyticsService.layer),
      Layer.provideMerge(AnalyticsSessionManager.layer),
      Layer.provideMerge(LifecycleService.layer),
      Layer.provideMerge(ReactNativeLifecycleAdapter),
      Layer.provideMerge(SchemaManager.layer),
      Layer.provideMerge(IdentityManager.Default),
      Layer.provideMerge(PersonInfoManager.Default),
      Layer.provideMerge(infrastructureLayer),
    ),
  );
};

/** Feature flag answer of a disabled client: no flags were ever evaluated. */
const DISABLED_FEATURE_FLAGS: FeatureFlagsResult = { flags: [], isStale: false };

/** Upper bound on events buffered before `init()` resolves. */
const PRE_INIT_BUFFER_CAP = 100;

/** Minimum gap between two foreground-triggered refreshes. */
const FOREGROUND_REFRESH_DEBOUNCE_MS = 60_000;

/** Paywall runtime config answer of a disabled client. */
const DISABLED_PAYWALL_RUNTIME_CONFIG: PaywallRuntimeConfig = { products: [], variables: {} };

/** Matches an Effect `Data.TaggedError` by tag without importing its class. */
const isTaggedError = (value: unknown, tag: string): boolean =>
  P.isObject(value) && value !== null && "_tag" in value && value._tag === tag;

const toErrorWithMessage = (code: VoidhashErrorCode, unknownCause: unknown) => {
  const message =
    P.isObject(unknownCause) && "message" in unknownCause && P.isString(unknownCause.message)
      ? unknownCause.message
      : String(unknownCause);

  return new VoidhashError(code, `${code}: ${message}`, { cause: unknownCause });
};

/**
 * Successful outcome of a {@link VoidhashClient.purchase} call. The failure
 * channel is the `Err` of the returned `Result` — cancellation and deferral
 * are expected outcomes, not errors.
 *
 * - `completed`: the transaction was validated by Voidhash and the person
 *   snapshot has been refreshed.
 * - `deferred`: the store completed the purchase but Voidhash could not be
 *   reached to validate the receipt. It sits in the outbox and is re-sent on
 *   boot, foreground and connectivity restore; access arrives once it lands.
 * - `cancelled`: the customer dismissed the native store sheet.
 * - `pending`: the purchase needs external action (e.g. approval) before it
 *   completes; access arrives once the transaction observer reconciles it.
 * - `disabled`: the client was created with `enabled: false`.
 */
export type PurchaseOutcome =
  | { status: "completed" }
  | { status: "deferred" }
  | { status: "cancelled" }
  | { status: "pending" }
  | { status: "disabled" };

/** Outcome of an identity switch reported by {@link VoidhashClient.identifySync}. */
export type IdentifyResult =
  | {
      /** The server confirmed the identity and returned the person. */
      status: "confirmed";
      person: SdkPerson;
    }
  | {
      /**
       * The server was unreachable. The device already runs under the new
       * distinct id and a `$identify` event is queued so the server catches up.
       */
      status: "deferred";
      // oxlint-disable-next-line effect/prefer-option-over-null -- public SDK answer consumed by non-Effect app code.
      person: SdkPerson | null;
    }
  | {
      /** The client was created with `enabled: false`, so nothing was recorded. */
      status: "disabled";
      person: null;
    };

/** Answer to an entitlement check for one perk. */
export interface HasPerkResult {
  /** The active grant behind `hasAccess`, when one exists. */
  grant: Option.Option<EntitlementGrant>;
  hasAccess: boolean;
  /**
   * The answer came from a cached snapshot that is past its refresh window,
   * either because a refresh is still running or because the server could not
   * be reached.
   */
  isStale: boolean;
  /**
   * The cached snapshot is past its two-day TTL. Access is still reported as
   * the snapshot recorded it; apps gating high-value content can decide to
   * treat this as untrusted.
   */
  isExpired: boolean;
  /**
   * Why the answer has the freshness it has.
   *
   * - `fresh`: confirmed by the server just now.
   * - `refresh-in-flight`: served from cache while a refresh is still running;
   *   its result lands for the next read.
   * - `refresh-failed`: served from cache because the refresh could not
   *   complete.
   * - `no-cache`: the SDK has never seen a snapshot for this identity, so
   *   `hasAccess` is `false` for lack of evidence rather than because access
   *   was denied.
   */
  reason: "fresh" | "refresh-in-flight" | "refresh-failed" | "no-cache";
}

/** Person snapshot together with how much to trust it. */
export interface CurrentPersonResult {
  /** The snapshot, or `null` before the SDK has ever seen one. */
  // oxlint-disable-next-line effect/prefer-option-over-null -- public SDK answer consumed by non-Effect app code.
  person: SdkPerson | null;
  /** Served from cache past its refresh window. */
  isStale: boolean;
  /** Served from cache past its TTL. */
  isExpired: boolean;
  /** Why the snapshot has the freshness it has; see {@link HasPerkResult.reason}. */
  reason: "fresh" | "refresh-in-flight" | "refresh-failed" | "no-cache";
}

/** Outcome of a synchronous person-attribute update. */
export type SetPersonAttributesResult =
  | {
      /** The server accepted and returned the updated snapshot. */
      status: "confirmed";
      person: SdkPerson;
    }
  | {
      /** The server was unreachable; the update is queued and will be retried. */
      status: "deferred";
      // oxlint-disable-next-line effect/prefer-option-over-null -- public SDK answer consumed by non-Effect app code.
      person: SdkPerson | null;
    }
  | {
      /** The client was created with `enabled: false`, so nothing was recorded. */
      status: "disabled";
      person: null;
    };

/** Outcome of an analytics flush. */
export interface FlushResult {
  /** Events the server accepted during this flush. */
  flushed: number;
  /** Events still queued, waiting for their next attempt. */
  pending: number;
  /** The failure that stopped the flush, when one did. */
  lastError?: VoidhashError;
}

type UninitializedEffectClient = ReturnType<typeof VoidhashEffectClient.makeUnitializedClient>;

// `makeInitializedClient` now returns `Effect<Facade, ...>` — unwrap to the
// facade type by extracting the Effect's Success channel.
type InitializedEffectClient = Effect.Success<
  ReturnType<typeof VoidhashEffectClient.makeInitializedClient>
>;

export class VoidhashClient {
  private _isInitialized = false;
  private analyticsFlushInFlight = Option.none<Promise<Result<FlushResult, VoidhashError>>>();
  private appLifecycleSubscription = Option.none<{ remove: () => void }>();
  private preInitAnalyticsBuffer: Array<{
    eventName: string;
    properties: Record<string, unknown>;
  }> = [];
  private initialDistinctId: Option.Option<string>;
  private enabled: boolean;
  private sdkConfiguration: SdkConfigurationHandle;
  private scheme: string;
  private internalSchema?: RuntimeSchema;
  private unstableSwallowErrors: boolean;
  private atomRegistry: AtomRegistry.AtomRegistry;
  private developmentMode: boolean;
  /** The configured embedded engine, when this client routes through one. */
  private nativeEngine?: VoidhashEngineSpec;
  private screenTracker: ScreenTracker;
  private manualScreenCounter = 0;
  private preloadPlacements: ReadonlyArray<string>;
  private preloadPaywallAsset?: (locationSlug: string, htmlUrl: string) => Promise<unknown>;
  private diagnosticHandler: Option.Option<VoidhashDiagnosticHandler>;
  private connectivitySubscription = Option.none<{ remove: () => void }>();
  private lastRecoveryAt = 0;
  /** Set by `end()` until the next `init()`: the runtime is gone. */
  private ended = false;
  /** The `init()` in progress, shared by every caller until it settles. */
  private initInFlight = Option.none<Promise<Result<void, VoidhashError>>>();

  private effectRuntime: ReturnType<typeof CreateEffectRuntime>;
  private readonly buildRuntime: () => ReturnType<typeof CreateEffectRuntime>;

  private unitializedClient: UninitializedEffectClient;
  private initializedClient?: InitializedEffectClient;

  constructor(
    initialDistinctId: unknown,
    scheme: string,
    baseUrl: string,
    ingestUrl: unknown,
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
    screenTracking: ScreenTrackingOptions = {},
    offlineOptions: {
      connectivity?: ConnectivityPort;
      onDiagnostic?: VoidhashDiagnosticHandler;
      preloadPlacements?: ReadonlyArray<string>;
      preloadPaywallAsset?: (locationSlug: string, htmlUrl: string) => Promise<unknown>;
    } = {},
  ) {
    this.initialDistinctId = Option.isOption(initialDistinctId)
      ? Option.filter(initialDistinctId, P.isString)
      : Option.liftPredicate(initialDistinctId, P.isString);
    this.enabled = enabled;
    this.developmentMode = __DEV__ && dev;
    this.scheme = scheme;
    this.internalSchema = internalSchema;
    this.unstableSwallowErrors = unstableSwallowErrors;
    this.atomRegistry = atomRegistry;
    this.preloadPlacements = offlineOptions.preloadPlacements ?? [];
    this.preloadPaywallAsset = offlineOptions.preloadPaywallAsset;
    this.diagnosticHandler = Option.fromUndefinedOr(offlineOptions.onDiagnostic);
    const mapScreen = screenTracking.mapScreen;
    this.screenTracker = createScreenTracker({
      enabled: enabled && (screenTracking.enabled ?? true),
      includeParams: screenTracking.includeParams ?? false,
      mapScreen: mapScreen ? (view) => Option.fromNullOr(mapScreen(view)) : undefined,
    });
    const normalizedIngestUrl = Option.isOption(ingestUrl)
      ? Option.filter(ingestUrl, P.isString)
      : Option.liftPredicate(ingestUrl, P.isString);
    this.sdkConfiguration = makeSdkConfiguration({
      baseUrl,
      debug,
      developmentMode: this.developmentMode,
      ingestUrl: normalizedIngestUrl.valueOrUndefined,
      publishableKey,
      readOnly: readOnly || !COMMERCE_FEATURES_ENABLED,
    });
    if (enabled && nativeEngine !== undefined) {
      nativeEngine.configure(
        publishableKey,
        effectEncodeJson({
          baseUrl,
          debug,
          dev: this.developmentMode,
          enabled,
          ingestUrl: normalizedIngestUrl.valueOrUndefined,
          readOnly: this.sdkConfiguration.isReadOnly(),
          screenTracking: { automatic: false },
        }),
      );
      this.nativeEngine = nativeEngine;
    }
    this.buildRuntime = () =>
      CreateEffectRuntime(
        platform,
        this.developmentMode,
        atomRegistry,
        this.sdkConfiguration.service,
        makeDiagnosticsLayer(this.diagnosticHandler),
        offlineOptions.connectivity
          ? makeConnectivityLayer(offlineOptions.connectivity)
          : Connectivity.noop,
        nativeEngine,
      );
    this.effectRuntime = this.buildRuntime();
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
      EffectRuntime.runSync(
        Effect.logWarning(`[voidhash] swallowed error in ${operation}`, result.error),
      );
      return Result.ok(undefined);
    }

    return result;
  }

  /**
   * Initializes from local identity, person and schema state. Schema refresh,
   * store observation and reconciliation continue in the background.
   * Resolves immediately without touching the store, the network or the
   * cache when the client was created with `enabled: false`.
   *
   * Idempotent: a call that overlaps a running `init()` joins it, and a call
   * on an initialized client resolves at once. Neither registers a second
   * lifecycle listener, transaction observer or flush timer.
   */
  async init(): Promise<Result<void, VoidhashError>> {
    if (!this.enabled) {
      return Result.ok(undefined);
    }
    if (Option.isSome(this.initInFlight)) {
      return this.initInFlight.value;
    }
    if (this.initializedClient !== undefined) {
      return Result.ok(undefined);
    }

    const inFlight = this.runInit().finally(() => {
      this.initInFlight = Option.none();
    });
    this.initInFlight = Option.some(inFlight);
    return inFlight;
  }

  private runInit(): Promise<Result<void, VoidhashError>> {
    return this.runSideEffect("init", async () => {
      if (this.ended) {
        // `end()` disposed the previous runtime along with its daemons and
        // store connection; a re-init starts from a fresh one.
        this.effectRuntime = this.buildRuntime();
        this.ended = false;
      }
      const initializedClientResult = await this.toResult(
        this.unitializedClient.init({
          distinctId: this.initialDistinctId.valueOrUndefined,
          internalSchema: this.internalSchema,
          preloadPaywallAsset: this.preloadPaywallAsset,
          preloadPlacements: this.preloadPlacements,
        }),
        "FAILED_TO_INITIALIZE_VOIDHASH_CLIENT",
      );
      if (initializedClientResult.isErr()) {
        return Result.err(initializedClientResult.error);
      }
      const initializedClient = initializedClientResult.value;
      // A fresh `init()` is the moment a corrected publishable key arrives, so
      // any authentication pause from the previous configuration is lifted.
      this.runInBackground("resumeAuthentication", initializedClient.resumeAuthentication());

      this.runInBackground(
        "startTransactionObserver",
        initializedClient
          .startTransactionObserver((transaction) => {
            this.runInBackground(
              "processObservedTransaction",
              initializedClient.processObservedTransaction(transaction),
            );
          })
          .pipe(Effect.andThen(initializedClient.reconcileObservedTransactions())),
      );

      this.initializedClient = initializedClient;
      this._isInitialized = true;

      // Set up analytics flush callback and transfer pre-init buffer
      initializedClient.setAnalyticsFlushCallback(() => {
        this.triggerBackgroundFlush("flush analytics from timer");
      });

      if (Arr.isReadonlyArrayNonEmpty(this.preInitAnalyticsBuffer)) {
        // Awaited: the transfer stamps the buffered events with a session,
        // which reads and writes the (asynchronous) cache adapter.
        const transferResult = await this.toResult(
          initializedClient.transferAnalyticsEvents(this.preInitAnalyticsBuffer),
          "FAILED_TO_TRANSFER_ANALYTICS_EVENTS",
        );
        if (transferResult.isErr()) {
          EffectRuntime.runSync(
            Effect.logWarning(
              "[voidhash] failed to transfer pre-init analytics events",
              transferResult.error,
            ),
          );
        }
        this.preInitAnalyticsBuffer = [];
      }

      const startupEventsResult = await this.toResult(
        initializedClient.captureAutomaticStartupEvents(),
        "FAILED_TO_CAPTURE_STARTUP_EVENTS",
      );
      if (startupEventsResult.isErr()) {
        EffectRuntime.runSync(
          Effect.logWarning(
            "[voidhash] failed to capture automatic startup analytics",
            startupEventsResult.error,
          ),
        );
      }

      // Awaited rather than run synchronously: `LifecycleAdapter.subscribe` is
      // an Effect the adapter owns, and an asynchronous implementation would
      // die under `runSync` — failing `init()` long after the client was
      // marked initialized and leaving a half-live client behind.
      const lifecycleResult = await this.toResult(
        initializedClient.setupAutomaticLifecycleEvents((eventName) => {
          this.capture(eventName);
          if (eventName === AUTOMATIC_EVENTS.APP_BECAME_ACTIVE) {
            this.handleForeground();
          }
          if (eventName === AUTOMATIC_EVENTS.APP_BACKGROUNDED) {
            this.triggerBackgroundFlush("flush analytics on background");
          }
        }),
        "FAILED_TO_SETUP_LIFECYCLE_EVENTS",
      );
      if (lifecycleResult.isErr()) {
        return Result.err(lifecycleResult.error);
      }
      this.appLifecycleSubscription = lifecycleResult.value;

      this.triggerBackgroundFlush("flush analytics after init");

      // Everything below runs behind `init()`: the client is usable from local
      // state the moment this returns.
      this.runInBackground("refreshAll", initializedClient.refreshAll());
      this.runInBackground("syncTransactionOutbox", initializedClient.syncTransactionOutbox());

      const connectivityResult = await this.toResult(
        initializedClient.observeConnectivity(() => {
          this.handleConnectivityRestored();
        }),
        "FAILED_TO_INITIALIZE_VOIDHASH_CLIENT",
      );
      if (connectivityResult.isOk()) {
        this.connectivitySubscription = connectivityResult.value;
      }

      return Result.ok(undefined);
    });
  }

  /**
   * Recovery chain shared by app foreground and connectivity restore:
   * half-open every tripped host, flush the queues and refresh anything
   * stale. Debounced to once a minute across both triggers, so a user
   * flipping between apps or a flapping network does not turn into a
   * request storm.
   */
  private recover(reason: string) {
    const client = this.initializedClient;
    if (!client) return;
    // oxlint-disable-next-line effect/use-clock-service -- plain debounce outside any Effect; the client wrapper has no Clock in scope here.
    const now = Date.now();
    if (now - this.lastRecoveryAt < FOREGROUND_REFRESH_DEBOUNCE_MS) return;
    this.lastRecoveryAt = now;
    this.runInBackground("halfOpenCircuits", client.halfOpenCircuits());
    this.triggerBackgroundFlush(`flush analytics ${reason}`);
    this.runInBackground("refreshAll", client.refreshAll());
    this.runInBackground("syncTransactionOutbox", client.syncTransactionOutbox());
  }

  private handleForeground() {
    this.recover("on foreground");
  }

  /** Connectivity went from offline to online; the facade filters repeats. */
  private handleConnectivityRestored() {
    this.recover("after connectivity restored");
  }

  /**
   * Ends the voidhash client: flushes analytics, closes the store connection,
   * removes the lifecycle and connectivity listeners and disposes the Effect
   * runtime, which stops the flush and persist daemons. Afterwards `capture()`
   * drops events with a diagnostic and `init()` builds a fresh runtime.
   * No-ops on a disabled client, which never acquired anything to tear down.
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
      Option.getOrUndefined(this.appLifecycleSubscription)?.remove();
      this.appLifecycleSubscription = Option.none();
      Option.getOrUndefined(this.connectivitySubscription)?.remove();
      this.connectivitySubscription = Option.none();
      this.initializedClient = undefined;
      this._isInitialized = false;
      this.ended = true;
      await this.effectRuntime.dispose();
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
   * Whether the SDK currently runs in observer ("read-only") mode. The
   * current release always returns `true` while commerce is unavailable.
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
   * - the `x-observer-mode` header of subsequent requests, including those the
   *   embedded native engine sends on this client's behalf.
   *
   * A purchase that already started keeps the mode it started with: switching
   * to observer mode mid-purchase must not leave that transaction unfinished
   * with the store. Store transactions already being processed when the call
   * lands may also complete under the previous mode.
   *
   * No-ops in effect on a disabled client — it never processes transactions.
   * While commerce is unavailable, passing `false` keeps observer mode on.
   */
  setReadOnly(readOnly: boolean) {
    this.sdkConfiguration.setReadOnly(readOnly || !COMMERCE_FEATURES_ENABLED);
    this.nativeEngine?.setReadOnly(this.sdkConfiguration.isReadOnly());
  }

  /**
   * Returns the current person snapshot together with how much to trust it.
   * The answer comes from cache whenever one exists — a stale entry is served
   * while a refresh runs behind the read — so this never waits on the network
   * and never fails because the server is unreachable. Pass
   * `{ forceFetch: true }` to prefer the server. Answers an empty snapshot
   * while disabled.
   */
  async getCurrentPerson(
    options: { forceFetch?: boolean } = {},
  ): Promise<Result<CurrentPersonResult, VoidhashError>> {
    if (!this.enabled) {
      return Result.ok({ isExpired: false, isStale: false, person: null, reason: "no-cache" });
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
   * Cache-first: a fresh snapshot answers immediately, a stale one is served
   * while a refresh runs behind the read, and an entitlement granted before
   * the device went offline keeps answering `true`. The result always says how
   * fresh it is (`isStale`, `isExpired`, `reason`) — it never fails because
   * the server is unreachable. Pass `{ forceFetch: true }` to prefer the
   * server.
   */
  async hasPerk(
    perkSlug: PerkSlug,
    options: {
      /**
       * @deprecated No longer read. A stale answer beats no answer, so the
       * cached grant is always served. Branch on `isStale`/`isExpired` in the
       * result instead. Removed in a future release.
       */
      allowStale?: boolean;
      /** Prefer the server, waiting for it before answering. */
      forceFetch?: boolean;
    } = {},
  ): Promise<Result<HasPerkResult, VoidhashError>> {
    if (!this.enabled) {
      return Result.ok({
        grant: Option.none(),
        hasAccess: false,
        isExpired: false,
        isStale: false,
        reason: "no-cache",
      });
    }

    if (!this.initializedClient) {
      return Result.err(new NotInitializedError());
    }

    return this.toResult(
      this.initializedClient.hasPerk(perkSlug, { forceFetch: options.forceFetch }),
      "FAILED_TO_GET_CURRENT_PERSON",
    );
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
   * Sets person attributes synchronously and reports whether the server
   * confirmed them. Performs a network round-trip, so this is a write — it is
   * blocked in read-only mode, mirroring `purchase`. When the server is
   * unreachable the update is queued and the result is `deferred` with the
   * last known snapshot, rather than an error.
   */
  async setPersonAttributesSync(
    attributes: PersonAttributes,
  ): Promise<Result<SetPersonAttributesResult, VoidhashError>> {
    if (!this.enabled) {
      return Result.ok({ person: null, status: "disabled" });
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

  /**
   * Returns the active analytics session id, or `undefined` before `init()`,
   * while disabled, or once the session has been idle past the inactivity
   * timeout. Reading does not extend the session.
   */
  // oxlint-disable-next-line effect/prefer-option-over-null -- public SDK method consumed by non-Effect app code; `undefined` is the documented "no active session" answer and mirrors the iOS and Android SDKs.
  getSessionId(): string | undefined {
    if (!this.enabled || !this.initializedClient) {
      return undefined;
    }
    return this.initializedClient.getCurrentSessionId();
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
   * Identifies the user by switching the current distinct id. The switch
   * happens locally first; when the server is unreachable it is queued as a
   * `$identify` event and delivered later rather than failing. Use
   * {@link identifySync} to learn which of the two happened.
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
      const result = await this.toResult(
        this.initializedClient.identify(externalUserId, options),
        "FAILED_TO_IDENTIFY",
      );
      return result.map(() => undefined);
    });
  }

  /**
   * Identifies the user and reports whether the server confirmed the switch
   * (`confirmed`, with the person) or the device switched locally and queued
   * the switch for later delivery (`deferred`, with the last known snapshot
   * for that identity, if any). Only a verdict the server will not change —
   * a non-retryable 4xx — is an `Err`.
   */
  async identifySync(
    externalUserId: string,
    options: {
      email?: string;
      name?: string;
    } = {},
  ): Promise<Result<IdentifyResult, VoidhashError>> {
    if (!this.enabled) {
      return Result.ok({ person: null, status: "disabled" });
    }

    if (!this.initializedClient) {
      return Result.err(new NotInitializedError());
    }
    const result = await this.toResult(
      this.initializedClient.identify(externalUserId, options),
      "FAILED_TO_IDENTIFY",
    );
    return result.map(
      (outcome): IdentifyResult =>
        outcome.status === "confirmed"
          ? { person: outcome.person, status: "confirmed" }
          : { person: outcome.person, status: "deferred" },
    );
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
   * Answers `Ok(null)` while disabled or while paywalls are unavailable.
   */
  async getPaywallForLocation(locationSlug: LocationSlug) {
    if (!this.enabled || !COMMERCE_FEATURES_ENABLED) {
      return Result.ok(null);
    }

    if (!this.initializedClient) {
      return Result.err(new NotInitializedError());
    }
    const exit = await this.effectRuntime.runPromiseExit(
      this.initializedClient.getPaywallForLocation(locationSlug),
    );
    if (Exit.isSuccess(exit)) return Result.ok(exit.value);
    const cause = Cause.squash(exit.cause);
    // `PaywallUnavailableError` is a state, not a fault: the caller renders
    // "unavailable" rather than reporting a failure, so its code survives.
    if (cause instanceof VoidhashError) return Result.err(cause);
    return Result.err(toErrorWithMessage("FAILED_TO_GET_PAYWALL_FOR_LOCATION", cause));
  }

  /**
   * Returns products available on the current platform.
   * Keys are the project's product slugs (resolved via the generated
   * `voidhash.gen.d.ts`). Values are `null` when the underlying store SDK
   * doesn't know about that product. Returns no products while disabled.
   */
  async getProducts() {
    if (!this.enabled) {
      return Result.ok<ProductsBySlug>(R.empty());
    }

    if (!this.initializedClient) {
      return Result.err(new NotInitializedError());
    }
    return this.toResult(this.initializedClient.getProducts(), "FAILED_TO_GET_PRODUCTS");
  }

  /**
   * Purchases a product. Temporarily unavailable in this release and blocked
   * in observer mode — the check reads the mode
   * in effect when the purchase starts, so a `setReadOnly()` landing later
   * doesn't abandon it. Resolves to a `Result`; cancellation and deferral are
   * `Ok` outcomes, every failure is an `Err` carrying a coded
   * {@link VoidhashError}. `completed` means Voidhash validated the receipt;
   * `deferred` means the store completed the purchase but the receipt is
   * still waiting in the outbox for the server. Answers
   * `Ok({ status: "disabled" })` while disabled.
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
      return Result.ok({ status: exit.value === true ? "completed" : "deferred" });
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

    if (this.ended) {
      // The runtime is disposed: nothing could deliver this event. Reported
      // rather than buffered, because a re-init is not expected.
      this.emitDiagnostic({
        code: "ANALYTICS_EVENT_DROPPED",
        kind: "eviction",
        message: `Dropped "${eventName.trim()}" — captured after end()`,
        operation: "capture",
        retryable: false,
      });
      return;
    }

    if (!this.initializedClient) {
      const normalized = eventName.trim();
      if (normalized) {
        this.preInitAnalyticsBuffer.push({ eventName: normalized, properties });
        // Bounded: `init()` normally resolves in milliseconds, so a buffer
        // growing past this means events are being captured faster than the
        // SDK can start. Drop the oldest rather than the newest.
        const overflow = this.preInitAnalyticsBuffer.length - PRE_INIT_BUFFER_CAP;
        if (overflow > 0) {
          const evicted = this.preInitAnalyticsBuffer.slice(0, overflow);
          this.preInitAnalyticsBuffer = this.preInitAnalyticsBuffer.slice(overflow);
          Arr.forEach(evicted, (dropped) => {
            this.emitDiagnostic({
              code: "ANALYTICS_EVENT_DROPPED",
              kind: "eviction",
              message: `Evicted "${dropped.eventName}" — the pre-init buffer reached its cap of ${PRE_INIT_BUFFER_CAP} events`,
              operation: "capture",
              retryable: false,
            });
          });
        }
      }
      return;
    }

    this.effectRuntime.runSync(this.initializedClient.capture(eventName, properties));
  }

  /**
   * Captures a `$screen` event for a screen the SDK cannot observe itself
   * (custom navigation, onboarding steps, pager pages). Every call is a new
   * screen instance, so calling it twice with the same name emits twice.
   * No-op while disabled or when `screenTracking.enabled` is `false`.
   */
  screen(name: string, properties: Record<string, unknown> = {}) {
    this.manualScreenCounter += 1;
    this.trackScreenView(
      {
        identity: `${name}#${this.manualScreenCounter}`,
        name,
        path: name,
        source: "manual",
      },
      properties,
    );
  }

  /**
   * Feeds a screen arrival observed by an integration through the screen
   * tracker and captures `$screen` when it is a new screen instance.
   * @internal
   */
  trackScreenView(view: ScreenView, properties: Record<string, unknown> = {}) {
    if (!this.enabled) {
      return;
    }
    const screenProperties = this.screenTracker.transition(view);
    if (Option.isNone(screenProperties)) {
      return;
    }
    this.capture(AUTOMATIC_EVENTS.SCREEN, { ...properties, ...screenProperties.value });
  }

  /**
   * Flushes queued analytics events. Nothing is ever queued while disabled, so
   * this no-ops.
   */
  async flush(): Promise<Result<FlushResult, VoidhashError>> {
    if (!this.enabled) {
      return Result.ok({ flushed: 0, pending: 0 });
    }

    if (Option.isSome(this.analyticsFlushInFlight)) {
      return this.analyticsFlushInFlight.value;
    }

    if (!this.initializedClient) {
      return Result.ok({ flushed: 0, pending: this.preInitAnalyticsBuffer.length });
    }

    const inFlight = this.toResult(this.initializedClient.flush(), "FAILED_TO_FLUSH_ANALYTICS")
      .then((result) =>
        result.map(
          (outcome): FlushResult => ({
            flushed: outcome.flushed,
            // The last delivery failure of this flush, when one stopped it.
            // Present alongside a non-zero `pending`, never instead of it: the
            // events are queued, not lost.
            lastError: Option.getOrUndefined(
              Option.map(outcome.lastError, (failure) =>
                toErrorWithMessage("FAILED_TO_FLUSH_ANALYTICS", failure),
              ),
            ),
            pending: outcome.pending,
          }),
        ),
      )
      .finally(() => {
        this.analyticsFlushInFlight = Option.none();
      });
    this.analyticsFlushInFlight = Option.some(inFlight);

    return inFlight;
  }

  // ===============================
  // IOS only methods
  // ===============================

  /** Presents Apple's offer-code sheet. Inert while commerce is unavailable. */
  async iosPresentCodeRedemptionSheet(): Promise<Result<void, VoidhashError>> {
    if (!this.enabled || !COMMERCE_FEATURES_ENABLED) {
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

  /** Presents Apple's subscription manager. Inert while commerce is unavailable. */
  async iosShowManageSubscriptions(): Promise<Result<void, VoidhashError>> {
    if (!this.enabled || !COMMERCE_FEATURES_ENABLED) {
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
    getSchema: (): Option.Option<RuntimeSchema> =>
      Option.fromUndefinedOr(this.initializedClient?.getSchema()),
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

  /** Routes a diagnostic to the host handler, swallowing handler exceptions. */
  private emitDiagnostic(diagnostic: VoidhashDiagnostic) {
    if (Option.isNone(this.diagnosticHandler)) return;
    // oxlint-disable-next-line effect/avoid-try-catch -- boundary with host application code: the handler is a plain callback the app supplies and may throw anything.
    try {
      this.diagnosticHandler.value(diagnostic);
    } catch {
      // A throwing host handler must never fail the SDK path that reported.
    }
  }

  /**
   * Runs an SDK-owned background task without awaiting it, reporting a failure
   * through the diagnostics hook rather than dropping it on the floor.
   */
  private runInBackground(operation: string, effect: Effect.Effect<unknown, unknown, any>) {
    void this.effectRuntime.runPromiseExit(effect).then((exit) => {
      if (Exit.isSuccess(exit)) return;
      this.emitDiagnostic({
        code: "BACKGROUND_TASK_FAILED",
        kind: "transport",
        message: `${operation} failed: ${Cause.pretty(exit.cause)}`,
        operation,
        retryable: true,
      });
    });
  }

  private triggerBackgroundFlush(operation: string) {
    void this.flush().then((result) => {
      if (result.isErr()) {
        EffectRuntime.runSync(Effect.logWarning(`[voidhash] failed to ${operation}`, result.error));
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
