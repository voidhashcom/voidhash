import * as R from "effect/Record";
import * as Arr from "effect/Array";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as Scope from "effect/Scope";
import * as Str from "effect/String";

import { VoidhashConfigurationError } from "./errors";
import type {
  AnalyticsConsent,
  AnalyticsFlushStatus,
  ResolvedVoidhashConfig,
  VoidhashClientOptions,
  VoidhashEventContext,
  VoidhashGroupProperties,
  VoidhashPerson,
  VoidhashPersonAttributes,
  VoidhashTrackOptions,
  VoidhashTraits,
} from "./types";
import {
  AD_DATA_SHARING_REVOCATIONS_KEY,
  ANALYTICS_CONSENT_KEY,
  isAnalyticsConsent,
  AnalyticsConsentState,
} from "./core/analytics/analytics-consent";
import {
  forgetHeldTouches,
  LATEST_TOUCH_KEY,
  parseTouch,
  touchProperties,
  touchTraits,
  readCookie,
  readTouchState,
  resolveFbc,
  touchSignature,
  touchStateKey,
  writeTouchState,
} from "./core/analytics/attribution";
import { normalizeAnalyticsRecord } from "./core/analytics/analytics-context";
import { AnalyticsService, makeAnalyticsService } from "./core/analytics/analytics-service";
import { CacheAdapter } from "./core/caching/cache-adapter";
import { CacheManager, makeCacheManager } from "./core/caching/cache-manager";
import { makeBrowserCacheAdapter } from "./core/caching/adapters/browser-cache-adapter";
import { Diagnostics, makeDiagnostics } from "./core/diagnostics";
import { type EventBus, EventBusProvider } from "./core/event-bus";
import {
  FeatureFlagService,
  makeFeatureFlagService,
} from "./core/feature-flags/feature-flag-service";
import {
  GROUP_IDENTIFY_EVENT,
  IdentityManager,
  isAnonymousDistinctId,
  makeIdentityManager,
  recordDigest,
} from "./core/identity/identity-manager";
import { toPersonTraits } from "./core/identity/person-traits";
import { isBooleanRecord, isStringRecord } from "./core/json";
import { ApiClient, makeApiClient } from "./core/networking/api-client";
import { AuthGate, makeAuthGate } from "./core/networking/auth-gate";
import { CircuitBreaker, makeCircuitBreaker } from "./core/networking/circuit-breaker";
import { HttpTransport, makeHttpTransport } from "./core/networking/http";
import { SingleFlight, makeSingleFlight } from "./core/networking/single-flight";
import { PlatformProvider, browserPlatformProvider } from "./core/platform/platform-provider";
import { DEFAULT_BASE_URL } from "./core/constants";
import { SdkConfiguration } from "./core/sdk-configuration";

const SECRET_KEY_PREFIX = "vh_sk_";

const assertPositiveInteger = (name: string, value: number) => {
  if (!Number.isInteger(value) || value < 1) {
    throw new VoidhashConfigurationError(`${name} must be a positive integer.`);
  }
};

/**
 * Parses an absolute `http(s)` URL option. A relative path or another scheme
 * would send requests somewhere unexpected, so it is a configuration error.
 */
const parseBaseUrl = (name: string, value: string) => {
  const url = Option.filter(
    Option.liftThrowable(() => new URL(value.trim()))(),
    (parsed) => parsed.protocol === "https:" || parsed.protocol === "http:",
  );
  if (Option.isNone(url)) {
    throw new VoidhashConfigurationError(
      `${name} must be an absolute http:// or https:// URL, such as https://www.example.com/vh.`,
    );
  }
  return url.value.toString();
};

/**
 * A string option, trimmed. Blank, missing, and non-string values count as not
 * set; plain JavaScript callers can pass an unset environment variable.
 */
const nonBlank = (value: unknown): Option.Option<string> =>
  P.isString(value) ? Option.filter(Option.some(value.trim()), Str.isNonEmpty) : Option.none();

export const resolveVoidhashConfig = (options: VoidhashClientOptions): ResolvedVoidhashConfig => {
  // Without a key the client is inert; see `VoidhashClientOptions.publishableKey`.
  const publishableKey = Option.getOrElse(nonBlank(options.publishableKey), () => "");
  // A secret key grants full access to the project; a web page publishes it.
  if (publishableKey.startsWith(SECRET_KEY_PREFIX)) {
    throw new VoidhashConfigurationError(
      "publishableKey is a secret key. Use the project's vh_pk_ publishable key in the browser, and rotate the secret key.",
    );
  }
  const baseUrl = Option.match(nonBlank(options.baseUrl), {
    onNone: () => DEFAULT_BASE_URL,
    onSome: (value) => parseBaseUrl("baseUrl", value),
  });
  // Ingest is served by the API origin, under `/i/v1`, unless overridden.
  const analyticsBaseUrl = Option.match(nonBlank(options.analytics?.baseUrl), {
    onNone: () => baseUrl,
    onSome: (value) => parseBaseUrl("analytics.baseUrl", value),
  });
  const maxBatchSize = options.analytics?.maxBatchSize ?? 20;
  const maxBatchBytes = options.analytics?.maxBatchBytes ?? 262_144;
  const maxQueueSize = options.analytics?.maxQueueSize ?? 1_000;
  const flushIntervalMs = options.analytics?.flushIntervalMs ?? 5_000;
  const ttlMs = options.featureFlags?.ttlMs ?? 300_000;
  const maxWaitMs = options.featureFlags?.maxWaitMs ?? 2_000;
  if (!Number.isInteger(maxWaitMs) || maxWaitMs < 0) {
    throw new VoidhashConfigurationError(
      "featureFlags.maxWaitMs must be zero or a positive integer.",
    );
  }
  const capturePageViews = options.analytics?.capturePageViews ?? true;
  const flagDefaults: unknown = options.featureFlags?.defaults ?? {};
  if (!isBooleanRecord(flagDefaults)) {
    throw new VoidhashConfigurationError(
      "featureFlags.defaults must map flag keys to true or false.",
    );
  }
  const analyticsConsentSource = options.analyticsConsentSource ?? "sdk";
  if (analyticsConsentSource !== "sdk" && analyticsConsentSource !== "app") {
    throw new VoidhashConfigurationError('analyticsConsentSource must be "sdk" or "app".');
  }
  const analyticsWhilePending = options.analyticsWhilePending ?? "drop";
  if (analyticsWhilePending !== "drop" && analyticsWhilePending !== "buffer") {
    throw new VoidhashConfigurationError('analyticsWhilePending must be "drop" or "buffer".');
  }
  // With the app as the source, nothing is recorded before it answers.
  const analyticsConsent =
    options.analyticsConsent ?? (analyticsConsentSource === "app" ? "pending" : "granted");
  const beforeSendOption = options.analytics?.beforeSend ?? [];
  const beforeSend = P.isFunction(beforeSendOption) ? [beforeSendOption] : beforeSendOption;
  if (!Array.isArray(beforeSend) || beforeSend.some((hook) => !P.isFunction(hook))) {
    throw new VoidhashConfigurationError(
      "analytics.beforeSend must be a function or a list of functions.",
    );
  }
  const sanitizeUrl = options.analytics?.sanitizeUrl;
  if (sanitizeUrl !== undefined && !P.isFunction(sanitizeUrl)) {
    throw new VoidhashConfigurationError("analytics.sanitizeUrl must be a function.");
  }

  assertPositiveInteger("analytics.maxBatchSize", maxBatchSize);
  assertPositiveInteger("analytics.maxBatchBytes", maxBatchBytes);
  assertPositiveInteger("analytics.maxQueueSize", maxQueueSize);
  assertPositiveInteger("analytics.flushIntervalMs", flushIntervalMs);
  assertPositiveInteger("featureFlags.ttlMs", ttlMs);
  if (!isAnalyticsConsent(analyticsConsent)) {
    throw new VoidhashConfigurationError(
      'analyticsConsent must be "granted", "denied", or "pending".',
    );
  }

  return {
    analytics: {
      baseUrl: analyticsBaseUrl,
      beforeSend,
      captureOutboundClicks: options.analytics?.captureOutboundClicks ?? true,
      // A page leave closes a page view, so it follows the page views.
      capturePageLeaves: options.analytics?.capturePageLeaves ?? capturePageViews,
      capturePageViews,
      // An inert client records nothing, so its consent reads as `denied`.
      enabled: publishableKey !== "" && (options.analytics?.enabled ?? true),
      flushIntervalMs,
      maxBatchBytes,
      maxBatchSize,
      maxQueueSize,
      ...(sanitizeUrl !== undefined && { sanitizeUrl }),
    },
    analyticsConsent,
    analyticsConsentSource,
    analyticsWhilePending,
    baseUrl,
    grantConsentOnIdentify: options.grantConsentOnIdentify === true,
    crossSubdomainIdentity: options.crossSubdomainIdentity ?? false,
    featureFlags: {
      defaults: { ...flagDefaults },
      maxWaitMs,
      persist: options.featureFlags?.persist ?? true,
      prefetchOnInit: options.featureFlags?.prefetchOnInit ?? false,
      refreshOnOnline: options.featureFlags?.refreshOnOnline ?? true,
      refreshOnVisibility: options.featureFlags?.refreshOnVisibility ?? true,
      ttlMs,
    },
    distinctId: Option.getOrUndefined(nonBlank(options.distinctId)),
    ...(options.onDiagnostic ? { onDiagnostic: options.onDiagnostic } : {}),
    publishableKey,
    storeBeforeConsent: options.storeBeforeConsent ?? true,
  };
};

/** Every service a client's effects can use. */
export type SdkServices =
  | AnalyticsConsentState
  | AnalyticsService
  | ApiClient
  | AuthGate
  | CacheAdapter
  | CacheManager
  | CircuitBreaker
  | Diagnostics
  | EventBusProvider
  | FeatureFlagService
  | HttpTransport
  | IdentityManager
  | PlatformProvider
  | SdkConfiguration
  | SingleFlight;

/* oxlint-disable effect/effect-run-in-body -- the client's runtime: where its effects are run. */

/**
 * Builds the services of one client, each from the ones it depends on. They
 * are built together, synchronously, on the first use, inside `scope`, which
 * holds the work the services start in the background.
 */
const buildServices = (
  config: ResolvedVoidhashConfig,
  eventBus: EventBus,
  analyticsConsent: AnalyticsConsentState["Service"],
  scope: Scope.Scope,
): Context.Context<SdkServices> => {
  const base = Context.make(SdkConfiguration, config).pipe(
    Context.add(EventBusProvider, eventBus),
    Context.add(AnalyticsConsentState, analyticsConsent),
    Context.add(PlatformProvider, browserPlatformProvider),
    Context.add(
      CacheAdapter,
      makeBrowserCacheAdapter({
        // Without `storeBeforeConsent`, only the consent choice reaches the
        // device before analytics consent is granted.
        mayPersist: (storageKey) =>
          config.storeBeforeConsent ||
          analyticsConsent.choice() === "granted" ||
          storageKey.endsWith(`:${ANALYTICS_CONSENT_KEY}`) ||
          storageKey.endsWith(`:${AD_DATA_SHARING_REVOCATIONS_KEY}`),
      }),
    ),
    Context.add(SingleFlight, Effect.runSync(makeSingleFlight)),
    // Takes the `fetch` of the page when the client starts.
    Context.add(HttpTransport, makeHttpTransport(globalThis.fetch)),
  );
  const build = <S, R>(make: Effect.Effect<S, never, R>, context: Context.Context<R>) =>
    Effect.runSync(Effect.provideContext(make, context));
  const diagnostics = Context.add(base, Diagnostics, build(makeDiagnostics(), base));
  const cache = Context.add(diagnostics, CacheManager, build(makeCacheManager(), diagnostics));
  // The breaker reads the circuits other pages of the site left open.
  const breaker = Context.add(cache, CircuitBreaker, build(makeCircuitBreaker(), cache));
  const authGate = Context.add(breaker, AuthGate, build(makeAuthGate(), breaker));
  const api = Context.add(authGate, ApiClient, build(makeApiClient(), authGate));
  const identity = Context.add(api, IdentityManager, build(makeIdentityManager(), api));
  const flags = Context.add(
    identity,
    FeatureFlagService,
    build(makeFeatureFlagService(), Context.add(identity, Scope.Scope, scope)),
  );
  return Context.add(flags, AnalyticsService, build(makeAnalyticsService(), flags));
};

/**
 * Runs a client's effects against its services, as a `ManagedRuntime` does.
 * The services are built on the first run. Every run joins the client's
 * scope, so `dispose` interrupts the runs still going, aborting their
 * requests, with the work the services started in the background; a run
 * after `dispose` is interrupted at once.
 */
export const createSdkRuntime = (
  config: ResolvedVoidhashConfig,
  eventBus: EventBus,
  analyticsConsent: AnalyticsConsentState["Service"],
) => {
  const scope = Scope.makeUnsafe();
  const runOptions = { onFiberStart: Fiber.runIn(Scope.forkUnsafe(scope, "parallel")) };
  let services = Option.none<Context.Context<SdkServices>>();
  const withServices = <A, E>(effect: Effect.Effect<A, E, SdkServices>) =>
    // Built inside the run, so a build that throws rejects that run.
    Effect.suspend(() =>
      Effect.provideContext(
        effect,
        Option.getOrElse(services, () => {
          const built = buildServices(config, eventBus, analyticsConsent, scope);
          services = Option.some(built);
          return built;
        }),
      ),
    );
  return {
    dispose: () => Effect.runPromise(Scope.close(scope, Exit.void)),
    runPromise: <A, E>(effect: Effect.Effect<A, E, SdkServices>) =>
      Effect.runPromise(withServices(effect), runOptions),
    runSync: <A, E>(effect: Effect.Effect<A, E, SdkServices>) =>
      Effect.runSync(withServices(effect)),
  };
};

/* oxlint-enable effect/effect-run-in-body */

// Effects that run against the runtime
export const initializeEffect = (initialDistinctId?: string) =>
  Effect.gen(function* initialize() {
    const identityManager = yield* IdentityManager;
    const analyticsService = yield* AnalyticsService;
    const authGate = yield* AuthGate;
    // A re-initialization may carry a corrected key, so the pause is lifted.
    yield* authGate.resume();
    // Before identity, so the first identify request already carries the
    // stored consent.
    yield* analyticsService.restoreConsent();
    return yield* identityManager.initialize(initialDistinctId);
  });

/**
 * Switches the device to `distinctId` and queues the link or the profile
 * update Voidhash needs; nothing here waits for the network. Events already
 * queued keep the id they were recorded with. An anonymous visitor's flags
 * answer for the user they signed in as until the user's arrive; another
 * user's flags are dropped. The caller refreshes them in the background.
 *
 * With `grantConsentOnIdentify`, a consent still `pending` is granted first, so
 * what was held for the answer is recorded under the visitor the link then
 * merges into the user.
 *
 * Resolves with whether it did anything: identifying the current user again
 * with the profile last queued for them does not.
 */
export const identifyEffect = (distinctId: string, traits?: VoidhashTraits) =>
  Effect.gen(function* identify() {
    const analyticsService = yield* AnalyticsService;
    const config = yield* SdkConfiguration;
    const consent = yield* AnalyticsConsentState;
    const identityManager = yield* IdentityManager;
    const featureFlags = yield* FeatureFlagService;
    const authGate = yield* AuthGate;
    // A new identity is a reason to try a paused key again.
    yield* authGate.resume();
    if (config.grantConsentOnIdentify && consent.current() === "pending") {
      yield* analyticsService.applyConsent("granted", { implied: true, persist: true });
    }
    const previousDistinctId = identityManager.getDistinctId();
    if (!(yield* identityManager.identify(distinctId, traits))) return false;
    if (Option.contains(previousDistinctId, distinctId)) return true;
    const visitor = Option.filter(previousDistinctId, isAnonymousDistinctId);
    yield* Option.isSome(visitor)
      ? featureFlags.carryOverFlags(visitor.value, distinctId)
      : featureFlags.clearCachedFlags(Option.getOrUndefined(previousDistinctId));
    return true;
  });

/** Last `$fbc`/`$fbp` written for a distinct id, so unchanged values are not sent again. */
const FB_TRAITS_KEY = "analytics:fb-traits";

/**
 * Records the current page: its campaign touch, if the URL carries one, and a
 * `$pageview` when `pageView` is set.
 *
 * A touch becomes person traits on a `$set` event: `$initial_*` through
 * `$set_once` and `$latest_*` through `$set`, together with Meta's `$fbc` and
 * `$fbp` when they are available. The `$pageview` of the touch carries its
 * values as `$`-prefixed properties.
 *
 * While consent is pending, touches are held and nothing is sent: in
 * the identity manager for the page, and also in `sessionStorage` for the
 * browser session unless `storeBeforeConsent` is `false`. The first page
 * recorded after consent is granted sends them. Without consent nothing is held.
 *
 * Nothing is recorded or held while the app paused analytics, or on a page
 * `analytics.sanitizeUrl` keeps private: a touch would carry its address as
 * the landing path.
 */
export const recordPageEffect = (options: { readonly pageView: boolean }) =>
  Effect.gen(function* recordPage() {
    const analyticsService = yield* AnalyticsService;
    const cacheManager = yield* CacheManager;
    const config = yield* SdkConfiguration;
    const consent = yield* AnalyticsConsentState;
    const identityManager = yield* IdentityManager;

    const { heldTouches } = identityManager;
    const stateKey = touchStateKey(config.publishableKey);
    const current = consent.current();
    if (current === "denied") {
      heldTouches.state = {};
      writeTouchState(stateKey, {});
      return;
    }
    if (consent.isPaused()) return;
    const page = yield* analyticsService.readPage();
    if (Option.isNone(page.url)) return;

    // oxlint-disable-next-line effect/use-clock-service -- formats the time read from the Clock service.
    const now = new Date(yield* Clock.currentTimeMillis);
    const state = { ...readTouchState(stateKey), ...heldTouches.state };
    const touch = Option.filter(
      parseTouch({
        now,
        referrer: Option.match(page.referrerUrl, { onNone: () => "", onSome: (url) => url.href }),
        url: page.url.value,
      }),
      (parsed) => touchSignature(parsed) !== state.signature,
    );
    const signature = Option.getOrElse(Option.map(touch, touchSignature), () => state.signature);

    const latest = Option.orElse(touch, () => Option.fromUndefinedOr(state.latest));
    const pageViewProperties = Option.match(latest, {
      onNone: () => ({}),
      onSome: touchProperties,
    });

    if (current === "pending") {
      if (Option.isSome(touch)) {
        heldTouches.state = {
          first: state.first ?? touch.value,
          latest: touch.value,
          signature,
        };
        if (config.storeBeforeConsent) writeTouchState(stateKey, heldTouches.state);
      }
      // Held for the answer, with the touches; nothing else is recorded yet.
      if (options.pageView && config.analyticsWhilePending === "buffer") {
        yield* analyticsService.enqueue("$pageview", pageViewProperties);
      }
      return;
    }

    heldTouches.state = {};
    const first = Option.orElse(Option.fromUndefinedOr(state.first), () => touch);
    writeTouchState(stateKey, signature === undefined ? {} : { signature });

    const distinctId = Option.getOrElse(identityManager.getDistinctId(), () => "");
    const fbTraits = R.getSomes({
      $fbc: resolveFbc({
        clickedAt: Option.match(latest, {
          onNone: () => now.getTime(),
          // `touch_at` is the ISO-8601 time the SDK wrote; a corrupt one reads as now.
          onSome: (value) => {
            // oxlint-disable-next-line effect/use-clock-service -- parses a stored time.
            const touchAt = Date.parse(value.touch_at ?? "");
            return Number.isNaN(touchAt) ? now.getTime() : touchAt;
          },
        }),
        cookie: readCookie("_fbc"),
        fbclid: Option.flatMap(latest, (value) => Option.fromUndefinedOr(value.fbclid)),
        now: now.getTime(),
      }),
      $fbp: readCookie("_fbp"),
    });
    const sentFbTraits = Option.filter(
      Option.map(yield* cacheManager.get<unknown>(FB_TRAITS_KEY), (hit) => hit.value),
      isStringRecord,
    );
    const changedFbTraits = R.filter(
      fbTraits,
      (value, key) =>
        !Option.exists(
          sentFbTraits,
          (sent) => sent.distinctId === distinctId && sent[key] === value,
        ),
    );

    const $set = {
      ...Option.match(latest, {
        onNone: () => ({}),
        onSome: (value) => touchTraits(value, "$latest_"),
      }),
      ...changedFbTraits,
    };
    const $setOnce = Option.match(first, {
      onNone: () => ({}),
      onSome: (value) => touchTraits(value, "$initial_"),
    });
    if (!R.isEmptyRecord($set) || !R.isEmptyRecord($setOnce)) {
      const queued = yield* analyticsService.enqueue("$set", {
        $process_person_profile: true,
        $set,
        $set_once: $setOnce,
      });
      // Meta's ids count as sent only once they are queued, not when the
      // event was kept out, and a touch kept out has no campaign to pass on.
      if (queued !== undefined && !R.isEmptyRecord(changedFbTraits)) {
        yield* cacheManager.set(FB_TRAITS_KEY, { ...fbTraits, distinctId });
      }
      const referrer = Option.flatMap(latest, (value) =>
        Option.fromUndefinedOr(value.store_referrer),
      );
      if (queued !== undefined && Option.isSome(referrer)) {
        yield* cacheManager.set(LATEST_TOUCH_KEY, referrer.value);
      }
    }

    if (options.pageView) {
      yield* analyticsService.enqueue("$pageview", pageViewProperties);
    }
  });

/** The page a page view is on, as its `$pageleave` reports it. */
export type PageViewContext = Pick<VoidhashEventContext, "page_title" | "url_origin" | "url_path">;

/**
 * Reads the page a page view about to start is on, kept for its `$pageleave`: a
 * client-side navigation moves the address on before the page view ends. None
 * where no page view is recorded either: on a private page and during a pause.
 */
export const readPageViewContextEffect = () =>
  Effect.gen(function* readPageViewContext() {
    const analyticsService = yield* AnalyticsService;
    const consent = yield* AnalyticsConsentState;
    const platform = yield* PlatformProvider;
    if (consent.isPaused()) return Option.none<PageViewContext>();
    const page = yield* analyticsService.readPage();
    if (Option.isNone(page.url)) return Option.none<PageViewContext>();
    const { page_title, url_origin, url_path } = platform.buildAnalyticsContext(page);
    return Option.some<PageViewContext>({ page_title, url_origin, url_path });
  });

/**
 * Queues the `$pageleave` of a page view, in the session of its page view; see
 * `AnalyticsService.lastSessionId`.
 */
export const recordPageLeaveEffect = (
  view: PageViewContext,
  engagement: Record<string, unknown>,
  provisional?: boolean,
) =>
  Effect.gen(function* recordPageLeave() {
    const analyticsService = yield* AnalyticsService;
    yield* analyticsService.enqueue(
      "$pageleave",
      { ...engagement, url_origin: view.url_origin, url_path: view.url_path },
      { context: view, provisional, sessionId: analyticsService.lastSessionId() },
    );
  });

/** See `AnalyticsService.settleProvisionalLeave`. */
export const settleProvisionalLeaveEffect = (outcome: "send" | "drop") =>
  Effect.gen(function* settleProvisionalLeave() {
    const analyticsService = yield* AnalyticsService;
    yield* analyticsService.settleProvisionalLeave(outcome);
  });

/**
 * Queues the `$outbound_click` of a link to `targetOrigin`. A private page
 * records none, as it records no page view.
 */
export const recordOutboundClickEffect = (targetOrigin: string) =>
  Effect.gen(function* recordOutboundClick() {
    const analyticsService = yield* AnalyticsService;
    const page = yield* analyticsService.readPage();
    if (Option.isSome(page.url)) {
      yield* analyticsService.enqueue("$outbound_click", { target_origin: targetOrigin });
    }
  });

/**
 * The campaign values of the latest touch for a store link. Read from storage,
 * as another tab may have recorded a newer touch or removed it.
 */
export const latestTouchReferrerEffect = () =>
  Effect.gen(function* latestTouchReferrer() {
    const cacheManager = yield* CacheManager;
    const cached = yield* cacheManager.get<unknown>(LATEST_TOUCH_KEY, { refresh: true });
    return Option.filter(
      Option.map(cached, (hit) => hit.value),
      P.isString,
    );
  });

/**
 * Starts a new anonymous identity and session. Events already queued keep the
 * id they were recorded with. The caller refreshes flags in the background.
 *
 * For a signed-in user this is their sign-out: `$sign_out` is recorded first,
 * with the id, groups and session being left. For an anonymous visitor it only
 * starts a fresh one, and records nothing.
 *
 * A consent `identify()` implied was the user's who is leaving, so it returns
 * to `pending` first, as `setAnalyticsConsent("pending")` would set it. That
 * discards or holds what is still queued, so a sign-out sends the queue before,
 * for at most {@link FLUSH_WAIT_MS}.
 */
export const resetEffect = () =>
  Effect.gen(function* reset() {
    const analyticsService = yield* AnalyticsService;
    const cacheManager = yield* CacheManager;
    const config = yield* SdkConfiguration;
    const identityManager = yield* IdentityManager;
    const featureFlags = yield* FeatureFlagService;
    const authGate = yield* AuthGate;
    yield* authGate.resume();
    const previousDistinctId = identityManager.getDistinctId();
    const isSignedIn = Option.exists(previousDistinctId, (id) => !isAnonymousDistinctId(id));
    if (isSignedIn) yield* analyticsService.enqueue("$sign_out");
    if (yield* analyticsService.isConsentImplied()) {
      if (isSignedIn) yield* Effect.timeoutOption(analyticsService.flush(), FLUSH_WAIT_MS);
      yield* analyticsService.applyConsent("pending", { persist: true });
    }
    yield* identityManager.reset();
    // The next end user on this device starts a session of their own, and
    // takes on no campaign of the one before.
    yield* analyticsService.rotateSession();
    yield* cacheManager.delete(LATEST_TOUCH_KEY);
    forgetHeldTouches(touchStateKey(config.publishableKey), identityManager.heldTouches);
    yield* featureFlags.clearCachedFlags(Option.getOrUndefined(previousDistinctId));
  });

/**
 * Signs the signed-in user out, as {@link resetEffect} does. Does nothing, and
 * resolves with `false`, when nobody is signed in: that is the one difference
 * between the two.
 */
export const signOutEffect = () =>
  Effect.gen(function* signOut() {
    const identityManager = yield* IdentityManager;
    if (!Option.exists(identityManager.getDistinctId(), (id) => !isAnonymousDistinctId(id))) {
      return false;
    }
    yield* resetEffect();
    return true;
  });

export const getSessionIdEffect = () =>
  Effect.gen(function* getSessionId() {
    const analyticsService = yield* AnalyticsService;
    return yield* analyticsService.getSessionId();
  });

/**
 * Splits person attributes into the reserved `email`/`name` fields and the
 * remaining free-form traits.
 */
const splitPersonAttributes = (attributes: VoidhashPersonAttributes) => {
  const { email, name, ...rest } = attributes;
  const traits = R.filter(
    rest,
    (value): value is Exclude<typeof value, undefined> => value !== undefined,
  );
  return { email, name, traits };
};

/** Returns the traits record, or `undefined` when it carries no entries. */
const nonEmptyTraits = (traits: VoidhashTraits) => {
  if (Arr.isReadonlyArrayNonEmpty(R.keys(traits))) {
    return traits;
  }

  return undefined;
};

/**
 * Updates the current person's profile, whatever the analytics consent: the
 * attributes are what the app says about the person, which flags and cohorts
 * depend on. Fire-and-forget either way. Under consent they are a `$set`
 * analytics event, queued and flushed by the normal pipeline. Without it no
 * event may be recorded, so they are queued as a person write of their own; see
 * `IdentityManager.queuePersonWrite`. Nothing is written while the app paused
 * analytics.
 */
export const setPersonAttributesEffect = (attributes: VoidhashPersonAttributes) =>
  Effect.gen(function* setPersonAttributes() {
    const analyticsService = yield* AnalyticsService;
    const consent = yield* AnalyticsConsentState;
    const identityManager = yield* IdentityManager;
    const { email, name, traits } = splitPersonAttributes(attributes);
    const $set: Record<string, unknown> = toPersonTraits(traits);
    if (email !== undefined) {
      $set.email = email;
    }
    if (name !== undefined) {
      $set.name = name;
    }
    if (consent.isPaused()) return;
    const distinctId = identityManager.getDistinctId();
    if (consent.current() !== "granted" && Option.isSome(distinctId)) {
      return yield* identityManager.queuePersonWrite(distinctId.value, $set);
    }
    yield* analyticsService.enqueue(
      "$set",
      { $set, $process_person_profile: true },
      { personWrite: true },
    );
  });

/**
 * Puts the end user in a group of a type, such as their company, which every later event carries
 * in `$groups`. Sends a `$groupidentify` with the group's properties when there are some, or when
 * the end user's group of that type changed, so the group is known even before any other event.
 */
export const groupEffect = (
  groupType: string,
  groupKey: string,
  properties?: VoidhashGroupProperties,
) =>
  Effect.gen(function* group() {
    const identityManager = yield* IdentityManager;
    const isChanged = yield* identityManager.setGroup(groupType, groupKey);
    if (!isChanged && properties === undefined) return;
    const digest = yield* sendGroup(groupType, { key: groupKey, properties });
    yield* identityManager.storeGroupDigests({
      ...(yield* identityManager.readGroupDigests()),
      [groupType]: digest,
    });
  });

/** A group as `setGroups()` holds it: its key, and its properties when it has some. */
interface GroupInput {
  readonly key: string;
  readonly properties?: Record<string, unknown>;
}

/** What tells one `$groupidentify` of a group type from another; see `storeGroupDigests`. */
const groupDigest = (group: GroupInput) =>
  recordDigest(group.key, normalizeAnalyticsRecord(group.properties ?? {}));

/**
 * Sends the `$groupidentify` of a group, and resolves with what to remember as sent: the group's
 * digest, or an empty text when it was not, so the next `setGroups()` sends it. Under analytics
 * consent it is sent once it is queued; without consent it is not an event to queue, and is sent
 * only when Voidhash answered that it took it; see `AnalyticsService.describeGroup`.
 */
const sendGroup = (groupType: string, group: GroupInput) =>
  Effect.gen(function* sendGroup() {
    const analyticsService = yield* AnalyticsService;
    const consent = yield* AnalyticsConsentState;
    const properties = {
      $group_type: groupType,
      $group_key: group.key,
      ...(group.properties !== undefined && { $group_set: group.properties }),
    };
    const isSent =
      consent.current() === "granted"
        ? (yield* analyticsService.enqueue(GROUP_IDENTIFY_EVENT, properties)) !== undefined
        : yield* analyticsService.describeGroup(properties);
    return isSent ? groupDigest(group) : "";
  });

/**
 * Replaces the groups the end user belongs to with `groups`, by group type. A type left out is
 * dropped, without an event. A `$groupidentify` is sent for a group whose key differs from the one
 * held for its type, or whose properties differ from the ones last sent for it, so the same call
 * again sends nothing. No groups at all is `resetGroups()`.
 */
export const setGroupsEffect = (groups: Readonly<Record<string, GroupInput>>) =>
  Effect.gen(function* setGroups() {
    const identityManager = yield* IdentityManager;
    if (R.isEmptyRecord(groups)) return yield* identityManager.resetGroups();
    const held = identityManager.getGroups();
    const sent = yield* identityManager.readGroupDigests();
    yield* identityManager.replaceGroups(R.map(groups, (group) => group.key));
    const digests = yield* Effect.forEach(
      R.toEntries(groups),
      ([groupType, group]) => {
        const lastSent = Option.fromUndefinedOr(sent[groupType]);
        // A group held from before its digest was kept is described again only with properties.
        const isUnchanged =
          held[groupType] === group.key &&
          Option.match(lastSent, {
            onNone: () => group.properties === undefined,
            onSome: (digest) => digest === groupDigest(group),
          });
        return Effect.map(
          isUnchanged ? Effect.succeed(lastSent) : Effect.asSome(sendGroup(groupType, group)),
          (digest) => Option.map(digest, (value): [string, string] => [groupType, value]),
        );
      },
      { concurrency: 1 },
    );
    yield* identityManager.storeGroupDigests(R.fromEntries(Arr.getSomes(digests)));
  });

/** Takes the end user out of every group; later events carry no `$groups`. */
export const resetGroupsEffect = () =>
  Effect.gen(function* resetGroups() {
    yield* (yield* IdentityManager).resetGroups();
  });

/** Follows groups another tab changed. */
export const syncGroupsEffect = () =>
  Effect.gen(function* syncGroups() {
    yield* (yield* IdentityManager).syncGroupsFromStorage();
  });

/** The groups the end user belongs to, by group type. */
export const getGroupsEffect = () =>
  Effect.gen(function* getGroups() {
    return (yield* IdentityManager).getGroups();
  });

/**
 * Records whether the end user agreed to sharing with ad platforms. Taking it
 * back is queued apart from analytics, which consent can block or discard; the
 * event is what carries it in order with an agreement still in the queue, under
 * consent. Agreeing needs consent. Anything but `true` takes it back.
 */
export const setAdDataSharingEffect = (granted: boolean) =>
  Effect.gen(function* setAdDataSharing() {
    const analyticsService = yield* AnalyticsService;
    const identityManager = yield* IdentityManager;
    if (granted !== true) {
      yield* identityManager.revokeAdDataSharing();
    } else if (yield* analyticsService.permits("person.setAdDataSharing")) {
      yield* identityManager.cancelAdDataSharingRevocation();
    }
    if ((yield* AnalyticsConsentState).current() === "granted") {
      yield* setPersonAttributesEffect({ $ad_data_sharing: granted === true });
    }
  });

/**
 * Synchronously persists person attributes to the server and returns the
 * resulting person snapshot, whatever the analytics consent. Agreeing to
 * sharing with ad platforms needs consent, so without it `$ad_data_sharing` is
 * left out unless it takes the agreement back. With nothing left to write, or
 * while the app paused analytics, the person is returned unchanged.
 */
export const setPersonAttributesSyncEffect = (
  attributes: VoidhashPersonAttributes,
): Effect.Effect<VoidhashPerson, unknown, AnalyticsConsentState | IdentityManager> =>
  Effect.gen(function* setPersonAttributesSync() {
    const identityManager = yield* IdentityManager;
    const consent = yield* AnalyticsConsentState;
    const { email, name, traits } = splitPersonAttributes(attributes);
    const allowed =
      consent.current() === "granted"
        ? traits
        : R.filter(traits, (value, key) => key !== "$ad_data_sharing" || value === false);
    const written = { email, name, traits: nonEmptyTraits(allowed) };
    if (consent.isPaused() || R.isEmptyRecord(R.filter(written, P.isNotUndefined))) {
      return yield* identityManager.getPerson();
    }
    return yield* identityManager.setPersonAttributesSync(written);
  });

/**
 * Queues an event and resolves with how many queued events are due, none when analytics
 * consent kept it out. Never sends anything itself: the caller decides
 * whether a full batch is worth an early flush.
 */
export const trackEffect = (
  eventName: string,
  properties?: Record<string, unknown>,
  options?: VoidhashTrackOptions,
) =>
  Effect.gen(function* track() {
    const analyticsService = yield* AnalyticsService;
    return Option.fromUndefinedOr(yield* analyticsService.enqueue(eventName, properties, options));
  });

/** Records the end user's analytics consent and applies it immediately. */
export const setAnalyticsConsentEffect = (consent: AnalyticsConsent) =>
  Effect.gen(function* setAnalyticsConsent() {
    if (!isAnalyticsConsent(consent)) {
      return yield* Effect.fail(
        new VoidhashConfigurationError(
          'Analytics consent must be "granted", "denied", or "pending".',
        ),
      );
    }
    const analyticsService = yield* AnalyticsService;
    yield* analyticsService.applyConsent(consent, { persist: true });
  });

/** Records what was held for the consent answer; see `AnalyticsService.replayBuffered`. */
export const replayBufferedEffect = () =>
  Effect.gen(function* replayBuffered() {
    const analyticsService = yield* AnalyticsService;
    yield* analyticsService.replayBuffered();
  });

/** Applies a consent change that another tab stored. */
export const syncAnalyticsConsentEffect = () =>
  Effect.gen(function* syncAnalyticsConsent() {
    const analyticsService = yield* AnalyticsService;
    yield* analyticsService.syncConsentFromStorage();
  });

export const getFeatureFlagsEffect = (keys?: ReadonlyArray<string>) =>
  Effect.gen(function* getFeatureFlags() {
    const featureFlags = yield* FeatureFlagService;
    return yield* featureFlags.getFeatureFlags(keys);
  });

export const refreshFeatureFlagsEffect = (keys?: ReadonlyArray<string>) =>
  Effect.gen(function* refreshFeatureFlags() {
    const featureFlags = yield* FeatureFlagService;
    return yield* featureFlags.refreshFeatureFlags(keys);
  });

/**
 * Prepares the transport for a fresh attempt after a foreground or
 * connectivity trigger: open circuits move to half-open, and an authentication
 * pause that has held for at least a minute is lifted for one probe.
 */
export const halfOpenCircuitsEffect = () =>
  Effect.gen(function* halfOpenCircuits() {
    const breaker = yield* CircuitBreaker;
    yield* breaker.halfOpenAll();
  });

export const refreshTrackedKeySetsEffect = () =>
  Effect.gen(function* refreshTrackedKeySets() {
    const featureFlags = yield* FeatureFlagService;
    yield* featureFlags.refreshTrackedKeySets();
  });

/**
 * Clears the retry backoff so a queue held back during an outage is sent as
 * soon as connectivity returns.
 */
export const resetAnalyticsBackoffEffect = () =>
  Effect.gen(function* resetAnalyticsBackoff() {
    const analyticsService = yield* AnalyticsService;
    yield* analyticsService.resetBackoff();
  });

export const flushAnalyticsEffect = () =>
  Effect.gen(function* flushAnalytics() {
    const analyticsService = yield* AnalyticsService;
    return yield* analyticsService.flush();
  });

/**
 * How long `flushAnalytics()` and `destroy()` wait for delivery. Pages call
 * them on the way to another page, often a checkout, which must not wait out
 * an unreachable Voidhash's request timeouts; what is not delivered by then
 * stays queued.
 */
export const FLUSH_WAIT_MS = 2_000;

/**
 * Waits for `delivery` at most {@link FLUSH_WAIT_MS}. When it takes longer,
 * resolves with what was accepted so far and what is still queued, and
 * `delivery` carries on in the background.
 */
export const boundedFlushEffect = <E>(delivery: Effect.Effect<AnalyticsFlushStatus, E>) =>
  Effect.gen(function* boundedFlush() {
    const analyticsService = yield* AnalyticsService;
    const acceptedBefore = yield* analyticsService.acceptedEvents();
    const finished = yield* Effect.timeoutOption(delivery, FLUSH_WAIT_MS);
    return yield* Option.match(finished, {
      onNone: () => analyticsService.statusSince(acceptedBefore),
      onSome: Effect.succeed,
    });
  });

export const startAnalyticsEffect = () =>
  Effect.gen(function* startAnalytics() {
    const analyticsService = yield* AnalyticsService;
    yield* analyticsService.start();
  });

export const stopAnalyticsEffect = () =>
  Effect.gen(function* stopAnalytics() {
    const analyticsService = yield* AnalyticsService;
    yield* analyticsService.stop();
  });

/** Another tab stored its analytics queue, which may shrink this tab's share. */
export const otherQueueChangedEffect = () =>
  Effect.gen(function* otherQueueChanged() {
    const analyticsService = yield* AnalyticsService;
    yield* analyticsService.otherQueueChanged();
  });

/**
 * The page was hidden, which on a phone can be the last thing it sees before
 * the browser discards it: queued events not stored yet are stored now.
 */
export const persistAnalyticsEffect = () =>
  Effect.gen(function* persistAnalytics() {
    const analyticsService = yield* AnalyticsService;
    yield* analyticsService.persistPending();
  });

/** The page is hidden for a navigation; see `AnalyticsService.leavePage`. */
export const leavePageEffect = (options: { readonly isUnloading: boolean }) =>
  Effect.gen(function* leavePage() {
    const analyticsService = yield* AnalyticsService;
    return yield* analyticsService.leavePage(options);
  });

/**
 * Sends the identity writes still queued and resolves with how many remain,
 * which is more than zero when Voidhash cannot be reached.
 */
export const flushIdentityEffect = () =>
  Effect.gen(function* flushIdentity() {
    const identityManager = yield* IdentityManager;
    return yield* identityManager.deliverOutbox();
  });

/** Retries queued identity writes now, after a connectivity or visibility change. */
export const retryIdentityEffect = () =>
  Effect.gen(function* retryIdentity() {
    const identityManager = yield* IdentityManager;
    yield* identityManager.retryNow();
  });

/** Stops background identity delivery; queued writes stay for the next page. */
export const stopIdentityEffect = () =>
  Effect.gen(function* stopIdentity() {
    const identityManager = yield* IdentityManager;
    yield* identityManager.stop();
  });

/**
 * Follows an identity switch another tab made. As in the tab that made it, an
 * anonymous visitor's flags answer for the user they signed in as, and any
 * other switch drops the previous person's flags; the caller refreshes them
 * in the background. A user who signed out there leaves no touch held here for
 * the next person. An id a sign-in on another subdomain retired is given up here
 * too, as the page may never start again. Resolves with whether the identity
 * changed.
 */
export const syncIdentityEffect = () =>
  Effect.gen(function* syncIdentity() {
    const config = yield* SdkConfiguration;
    const identityManager = yield* IdentityManager;
    const featureFlags = yield* FeatureFlagService;
    const followed = yield* identityManager.syncFromStorage();
    const givenUp = yield* identityManager.reconcileSharedId({ retiredOnly: true });
    const previous = Option.orElse(followed, () => givenUp);
    if (Option.isNone(previous)) return false;
    if (!isAnonymousDistinctId(previous.value)) {
      forgetHeldTouches(touchStateKey(config.publishableKey), identityManager.heldTouches);
    }
    const current = identityManager.getDistinctId();
    const isSignIn =
      isAnonymousDistinctId(previous.value) &&
      Option.exists(current, (distinctId) => !isAnonymousDistinctId(distinctId));
    yield* isSignIn && Option.isSome(current)
      ? featureFlags.carryOverFlags(previous.value, current.value)
      : featureFlags.clearCachedFlags(previous.value);
    return true;
  });
