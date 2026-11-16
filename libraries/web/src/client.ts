import * as P from "effect/Predicate";
import * as Arr from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as Str from "effect/String";

import {
  VoidhashDestroyedError,
  VoidhashError,
  VoidhashInvalidArgumentError,
  VoidhashNotInitializedError,
} from "./errors";
import {
  boundedFlushEffect,
  createSdkRuntime,
  flushAnalyticsEffect,
  getFeatureFlagsEffect,
  flushIdentityEffect,
  getGroupsEffect,
  getSessionIdEffect,
  groupEffect,
  halfOpenCircuitsEffect,
  identifyEffect,
  initializeEffect,
  latestTouchReferrerEffect,
  leavePageEffect,
  otherQueueChangedEffect,
  persistAnalyticsEffect,
  readPageViewContextEffect,
  recordOutboundClickEffect,
  recordPageEffect,
  recordPageLeaveEffect,
  refreshFeatureFlagsEffect,
  refreshTrackedKeySetsEffect,
  replayBufferedEffect,
  resetAnalyticsBackoffEffect,
  resetEffect,
  resetGroupsEffect,
  retryIdentityEffect,
  resolveVoidhashConfig,
  setPersonAttributesEffect,
  setAdDataSharingEffect,
  setAnalyticsConsentEffect,
  setGroupsEffect,
  setPersonAttributesSyncEffect,
  settleProvisionalLeaveEffect,
  signOutEffect,
  startAnalyticsEffect,
  stopAnalyticsEffect,
  stopIdentityEffect,
  syncGroupsEffect,
  syncIdentityEffect,
  syncAnalyticsConsentEffect,
  trackEffect,
  type PageViewContext,
  type SdkServices,
} from "./client-effect";
import {
  ANALYTICS_CONSENT_KEY,
  type AnalyticsConsentState,
  makeAnalyticsConsentState,
} from "./core/analytics/analytics-consent";
import { encodeValue } from "./core/analytics/attribution";
import { observeNavigation } from "./core/analytics/navigation";
import { measurePageView, observeOutboundClicks } from "./core/analytics/page-engagement";
import { EventBus } from "./core/event-bus";
import { isJsonObject } from "./core/json";
import { FeatureFlagService, isEnabledByDefault } from "./core/feature-flags/feature-flag-service";
import {
  ANONYMOUS_DISTINCT_ID_PREFIX,
  isAnonymousDistinctId,
  LEGACY_ANONYMOUS_DISTINCT_ID_PREFIX,
  DISTINCT_ID_KEY,
  GROUPS_KEY,
  IdentityManager,
} from "./core/identity/identity-manager";
import type { MethodBeforeInitialize } from "./methods-before-initialize";
import type {
  AnalyticsConsent,
  AnalyticsFlushResult,
  AnalyticsFlushStatus,
  FeatureFlagEntry,
  FeatureFlagKey,
  FeatureFlagsResult,
  FeatureFlagValue,
  VoidhashClientOptions,
  VoidhashEventMap,
  VoidhashEventName,
  VoidhashGroup,
  VoidhashGroupProperties,
  VoidhashPerson,
  VoidhashPersonAttributes,
  VoidhashTrackOptions,
  VoidhashTraits,
  VoidhashDiagnostic,
  ResolvedVoidhashConfig,
} from "./types";

/** How often the connectivity/visibility triggers are allowed to refresh. */
const REFRESH_DEBOUNCE_MS = 60_000;

/**
 * How many calls made before `initialize()` may wait for it. An app that never
 * calls it, or calls it only after a long delay, cannot pile up calls without
 * bound; past the limit they reject at once.
 */
const MAX_CALLS_BEFORE_INITIALIZE = 1000;

/** How long `destroy()` waits for events still behind an identity call before it tears down. */
const EVENT_DRAIN_WAIT_MS = 2000;

/** Whether the client runs in a browser, the only place it can start. */
const hasBrowser = () => !P.isUndefined(globalThis.window) && !P.isUndefined(globalThis.document);

type ClientState = "destroyed" | "idle" | "initializing" | "ready";

/**
 * Marks a call that waits for `initialize()` when made before it, with the
 * number of starts that had failed when it was made.
 */
interface CallBeforeInitialize {
  readonly failedStarts: number;
}

/** What an inert client answers a flag read with. */
const NO_FLAGS: FeatureFlagsResult = { flags: [], isExpired: true, isStale: true };

const toErrorInstance = (cause: unknown): Error => {
  if (P.isError(cause)) {
    return cause;
  }
  return new VoidhashError(String(cause));
};

const toError = (errorCode: string, cause: unknown) => {
  const error = toErrorInstance(cause);
  return new VoidhashError(`${errorCode}: ${error.message}`, {
    cause: error,
  });
};

/** Rewrites every failure and defect of `effect` into a coded `VoidhashError`. */
const withErrorCode = <T, E, R>(effect: Effect.Effect<T, E, R>, errorCode: string) =>
  Effect.catchCause(effect, (cause) => Effect.fail(toError(errorCode, Cause.squash(cause))));

/**
 * Bridges an existing promise into the Effect world, preserving the rejection
 * value as the failure so it surfaces unchanged to the caller.
 */
const fromPromise = <T>(evaluate: () => Promise<T>): Effect.Effect<T, unknown> =>
  Effect.tryPromise({ try: evaluate, catch: (cause) => cause });

/** Why `userId` cannot be identified, if it cannot. */
const validateUserId = (userId: unknown): Option.Option<VoidhashInvalidArgumentError> => {
  if (!P.isString(userId) || !Str.isNonEmpty(userId.trim())) {
    return Option.some(new VoidhashInvalidArgumentError("userId must be a non-blank string."));
  }
  if (isAnonymousDistinctId(userId)) {
    return Option.some(
      new VoidhashInvalidArgumentError(
        `userId must be your own user id; ids starting with ${ANONYMOUS_DISTINCT_ID_PREFIX} or ${LEGACY_ANONYMOUS_DISTINCT_ID_PREFIX} are anonymous.`,
      ),
    );
  }
  return Option.none();
};

/** Why a group cannot be kept, if it cannot: a type such as `company`, and a key of 1 to 256 characters. */
const invalidGroup = (groupType: unknown, groupKey: string) =>
  !P.isString(groupType) || !/^[a-z][a-z0-9_]{0,63}$/.test(groupType)
    ? Option.some(new VoidhashInvalidArgumentError("groupType must look like company or team_1."))
    : Str.isEmpty(groupKey) || groupKey.length > 256
      ? Option.some(new VoidhashInvalidArgumentError("groupKey must have 1 to 256 characters."))
      : Option.none();

const buildPageProperties = (pageName?: string, properties?: Record<string, unknown>) => {
  if (!pageName) {
    return properties;
  }
  return { ...properties, page_name: pageName };
};

export class VoidhashWebClient {
  private readonly config: ResolvedVoidhashConfig;
  private readonly eventBus: EventBus;
  private readonly analyticsConsent: AnalyticsConsentState["Service"];
  private readonly runtime: ReturnType<typeof createSdkRuntime>;
  /**
   * Set for a client without a publishable key. It never leaves the `idle`
   * state, which already answers the synchronous reads with nothing, and every
   * other method returns before it reaches the runtime, whose services are what
   * touch storage and the network.
   */
  private readonly isInert: boolean;
  private state: ClientState = "idle";
  // The last of the calls `inOrder` runs, settled or not, and how many have not settled.
  private lastIdentityCall: Promise<unknown> = Promise.resolve();
  private unsettledIdentityCalls = 0;
  private initializePromise = Option.none<Promise<void>>();
  /**
   * Calls made before `initialize()` in a browser, waiting for it in the order
   * they were made, and how many such calls were made since the client last
   * started; see {@link MAX_CALLS_BEFORE_INITIALIZE}.
   */
  private waitingForInitialize: Array<{
    readonly proceed: () => void;
    readonly reject: (error: unknown) => void;
  }> = [];
  private callsBeforeInitialize = 0;
  /**
   * Events `capture()`, `track()` or `page()` accepted that are not queued yet,
   * as they wait for `initialize()` or an identity call. `flushAnalytics()`
   * sends them too.
   */
  private readonly eventsNotQueued = new Set<Promise<unknown>>();
  /**
   * What the events waiting for an identity call wait on, and how many still
   * do. An event made while any does waits on the same, so events are queued
   * in the order they were made.
   */
  private eventGate: Promise<unknown> = Promise.resolve();
  private eventsBehindGate = 0;
  /**
   * The starts that failed, and why the last one did. A call made before a
   * start that failed is rejected with its error, also one that was still
   * behind an identity call when the start failed; see `whenReady`.
   */
  private failedStarts = 0;
  private lastStartFailure: unknown = undefined;
  /**
   * Set while `destroy()` waits for the events made before it that still wait
   * for an identity call: those, and the identity calls ahead of them, go on.
   */
  private isDrainingEvents = false;
  private destroyPromise = Option.none<Promise<void>>();
  private listeners: Array<() => void> = [];
  private inFlightFlush = Option.none<Promise<AnalyticsFlushStatus>>();
  private lastRefreshAt = 0;
  /**
   * Ends the page view on screen, and returns what records its `$pageleave`.
   * Set once page tracking starts.
   */
  private closePageView: () => Effect.Effect<void, unknown, SdkServices> = () => Effect.void;

  // Service references for sync access (set during init)
  private featureFlagService = Option.none<FeatureFlagService["Service"]>();
  private identityManagerService = Option.none<IdentityManager["Service"]>();

  constructor(options: VoidhashClientOptions) {
    this.config = resolveVoidhashConfig(options);
    this.isInert = this.config.publishableKey === "";
    this.eventBus = new EventBus();
    this.analyticsConsent = makeAnalyticsConsentState(this.config);
    this.runtime = createSdkRuntime(this.config, this.eventBus, this.analyticsConsent);
  }

  // Effect requires service type parameter
  private runEffect<T>(effect: Effect.Effect<T, unknown, any>, errorCode: string): Promise<T> {
    return this.runtime.runPromise(withErrorCode(effect, errorCode));
  }

  /**
   * Loads the state saved in the browser and starts the SDK: page tracking,
   * delivery of queued events and identity writes, and the listeners for
   * connectivity, visibility, and other tabs. Resolves without waiting for the
   * network. Calls made before it, such as `capture()` and `identify()`, then
   * run in the order they were made; a failed start rejects them.
   * Safe to call more than once. Needs a browser: on a server, render
   * `VoidhashProvider` or call it from client-side code instead. When
   * `destroy()` is called before it finishes, it resolves without starting
   * anything, so it records no page. A client without a publishable key
   * resolves at once, anywhere.
   */
  initialize(): Promise<void> {
    if (this.isInert) return Promise.resolve();
    if (this.isDestroying()) {
      return Promise.reject(new VoidhashDestroyedError());
    }

    if (!hasBrowser()) {
      return Promise.reject(
        new VoidhashError(
          "initialize() needs a browser. On a server, render VoidhashProvider or call initialize() from client-side code, such as an effect.",
        ),
      );
    }

    if (this.state === "ready") {
      return this.runtime.runPromise(Effect.void);
    }

    if (Option.isSome(this.initializePromise)) {
      return this.initializePromise.value;
    }

    this.state = "initializing";
    const config = this.config;

    const initializePromise = this.runtime
      .runPromise(
        Effect.gen({ self: this }, function* initializeClient() {
          const distinctId = yield* withErrorCode(
            initializeEffect(config.distinctId),
            "FAILED_TO_INITIALIZE",
          );

          // Grab service references for sync access
          this.featureFlagService = Option.some(yield* FeatureFlagService);
          this.identityManagerService = Option.some(yield* IdentityManager);

          // The ticker only runs while analytics consent is granted, and
          // starts or stops as consent changes.
          yield* withErrorCode(startAnalyticsEffect(), "FAILED_TO_START_ANALYTICS");

          // A client destroyed while it started, for example on the way to a
          // page the app keeps out of analytics, must not record the page it
          // is on now. Checked after the last step that can wait; `destroy()`
          // stops what started above.
          if (this.isDestroying()) return;

          // Handle scheduled flush events from the analytics service timer
          this.eventBus.on("analytics-flush-needed", () => this.flushInBackground());

          this.attachBrowserListeners(config);
          this.attachPageTracking(config);

          // Initialization resolves once local state is loaded; the prefetch
          // refreshes in the background so a slow or unreachable backend never
          // delays startup.
          if (config.featureFlags.prefetchOnInit) {
            void this.runEffect(getFeatureFlagsEffect(), "FAILED_TO_PREFETCH_FLAGS").catch(
              () => {},
            );
          }

          const initializedDistinctId = yield* Option.match(distinctId, {
            onNone: () => Effect.die("Identity manager did not produce a distinct id."),
            onSome: Effect.succeed,
          });
          this.eventBus.emit("initialized", { distinctId: initializedDistinctId });
          this.state = "ready";
        }),
      )
      .catch((error: unknown) => {
        // A failed start can be retried with another initialize().
        if (this.state === "initializing") this.state = "idle";
        this.failedStarts += 1;
        this.lastStartFailure = error;
        throw error;
      })
      .finally(() => {
        this.initializePromise = Option.none();
      });
    this.initializePromise = Option.some(initializePromise);
    // Attached now, before a call made from here on, so the calls that waited
    // run first, in the order they were made; a failed start rejects them.
    this.callsBeforeInitialize = 0;
    Arr.forEach(this.waitingForInitialize.splice(0), ({ proceed, reject }) => {
      initializePromise.then(proceed, reject);
    });

    return initializePromise;
  }

  /**
   * Stops the client for good: removes its listeners, stops background
   * delivery, sends what it can, and releases its resources. Queued events
   * and identity links stay on the device for the next page, except events
   * kept in memory past the storage budget during a long outage, which are
   * reported as `ANALYTICS_EVENT_DROPPED`. Calling it again
   * returns the same teardown; the client cannot be initialized afterwards.
   */
  destroy(): Promise<void> {
    if (this.isInert) return Promise.resolve();
    if (Option.isSome(this.destroyPromise)) {
      return this.destroyPromise.value;
    }
    this.callsBeforeInitialize = 0;
    Arr.forEach(this.waitingForInitialize.splice(0), ({ reject }) => {
      reject(new VoidhashDestroyedError());
    });
    // Events the app made before this call may still wait for an `identify()`
    // or a `signOut()` it did not await. They are queued first, so the flush
    // below sends them; an identity call does not wait for the network, and
    // the wait is bounded all the same.
    const accepted = this.state === "ready" ? [...this.eventsNotQueued] : [];
    this.isDrainingEvents = Arr.isReadonlyArrayNonEmpty(accepted);
    const drained = this.isDrainingEvents
      ? new Promise<void>((resolve) => {
          const giveUp = setTimeout(resolve, EVENT_DRAIN_WAIT_MS);
          void Promise.allSettled(accepted).then(() => {
            clearTimeout(giveUp);
            resolve();
          });
        })
      : Promise.resolve();
    const teardown = drained
      .then(() => {
        this.isDrainingEvents = false;
        return this.runTeardown();
      })
      .finally(() => {
        this.state = "destroyed";
        return this.runtime.dispose();
      });
    this.destroyPromise = Option.some(teardown);
    return teardown;
  }

  /** Stops what `initialize()` started, sending what it can; `destroy()` disposes of the runtime after. */
  private runTeardown(): Promise<void> {
    return this.runtime.runPromise(
      Effect.gen({ self: this }, function* destroyClient() {
        // A start that fails still has to be torn down, so its outcome is
        // only waited for.
        if (this.state === "initializing" && Option.isSome(this.initializePromise)) {
          const pending = this.initializePromise.value;
          yield* Effect.catch(
            fromPromise(() => pending),
            () => Effect.void,
          );
        }

        this.detachBrowserListeners();
        // Every step is best effort, so one that fails cannot keep the
        // client from being released. Failures are dropped with `catch`, not
        // `Effect.ignore`, whose logging option adds about 2 KB gzipped to
        // every page that loads the SDK.
        // The page view ends here for this client, which sees no more of it.
        yield* Effect.catch(
          fromPromise(() => this.runEffect(this.closePageView(), "FAILED_TO_RECORD_PAGE")),
          () => Effect.void,
        );
        yield* Effect.catch(
          fromPromise(() => this.runEffect(stopIdentityEffect(), "FAILED_TO_STOP_IDENTITY")),
          () => Effect.void,
        );
        // Bounded, as the page may be on its way elsewhere; the requests
        // still out are aborted with the runtime, and their events stay
        // queued for the next page.
        yield* Effect.catch(
          boundedFlushEffect(fromPromise(() => this.flushAnalyticsInternal())),
          () => Effect.void,
        );
        yield* Effect.catch(
          fromPromise(() => this.runEffect(stopAnalyticsEffect(), "FAILED_TO_STOP_ANALYTICS")),
          () => Effect.void,
        );
      }),
    );
  }

  /**
   * The current distinct id, anonymous or identified. `undefined` before
   * `initialize()` resolves. Put it on the payment your provider takes, so
   * Voidhash credits the purchase to this person: send it to your server and
   * set it as `metadata.voidhash_distinct_id` on a Stripe Checkout Session, or
   * report it with a payment source's payment. With `crossSubdomainIdentity`,
   * reading it keeps this device on this id, so read it when you need it.
   */
  // oxlint-disable-next-line effect/prefer-option-over-null -- the public API takes and returns plain values, so callers do not need Effect.
  getDistinctId(): string | undefined {
    const distinctId = this.peekDistinctId();
    if (
      distinctId !== undefined &&
      this.config.crossSubdomainIdentity &&
      Option.isSome(this.identityManagerService)
    ) {
      this.runtime.runSync(this.identityManagerService.value.markHandedOut());
    }
    return distinctId;
  }

  /**
   * The current distinct id, for the SDK's own reads: unlike `getDistinctId()`,
   * this does not count as handing it to the app.
   * @internal
   */
  // oxlint-disable-next-line effect/prefer-option-over-null -- the public API takes and returns plain values, so callers do not need Effect.
  peekDistinctId(): string | undefined {
    if (this.state !== "ready") {
      return undefined;
    }
    return Option.getOrUndefined(
      Option.flatMap(this.identityManagerService, (service) => service.getDistinctId()),
    );
  }

  /**
   * Whether a flag is enabled: its last evaluated value, synchronously, or its
   * `featureFlags.defaults` entry before it is evaluated, also while
   * `initialize()` runs, as a script tag starts the client. Throws before
   * `initialize()` and after `destroy()`. Without a publishable key it is
   * always the default.
   */
  isFeatureEnabled(key: FeatureFlagKey) {
    if (this.isInert) return this.isFeatureEnabledByDefault(key);
    if (this.state === "initializing" && !this.isDestroying()) {
      return Option.match(this.featureFlagService, {
        onNone: () => this.isFeatureEnabledByDefault(key),
        onSome: (service) => service.isEnabled(key),
      });
    }
    return this.runtime.runSync(
      Effect.flatMap(this.ensureReady, () =>
        Option.isSome(this.featureFlagService)
          ? Effect.succeed(this.featureFlagService.value.isEnabled(key))
          : Effect.die("Feature flag service is unavailable after initialization."),
      ),
    );
  }

  /**
   * The last evaluated entry of a flag, synchronously; `undefined` for a flag
   * not evaluated yet or unknown, also while `initialize()` runs. Throws
   * before `initialize()` and after `destroy()`.
   */
  // oxlint-disable-next-line effect/prefer-option-over-null -- the public API takes and returns plain values, so callers do not need Effect.
  getFeatureVariant(key: FeatureFlagKey): FeatureFlagEntry | undefined {
    if (this.isInert) return undefined;
    if (this.state === "initializing" && !this.isDestroying()) {
      return Option.getOrUndefined(
        Option.flatMap(this.featureFlagService, (service) => service.getVariant(key)),
      );
    }
    return Option.getOrUndefined(
      this.runtime.runSync(
        Effect.flatMap(this.ensureReady, () =>
          Option.isSome(this.featureFlagService)
            ? Effect.succeed(this.featureFlagService.value.getVariant(key))
            : Effect.die("Feature flag service is unavailable after initialization."),
        ),
      ),
    );
  }

  /**
   * The value of the variant a flag assigned, from its last evaluation,
   * synchronously: the variant's value as configured in Voidhash, when it is
   * text and the flag is enabled. `null` when the flag is off, unknown or not
   * evaluated yet, when the variant's value is not text, before `initialize()`
   * resolves, after `destroy()`, and without a publishable key. Never throws.
   * Typed by the variant values the generated declaration file lists for the
   * flag; a variant added since generation is not in that union.
   */
  // oxlint-disable-next-line effect/prefer-option-over-null -- the public API takes and returns plain values, so callers do not need Effect.
  getVariantValue<K extends FeatureFlagKey>(key: K): FeatureFlagValue<K> | null {
    if (this.state !== "ready" || this.isDestroying()) return null;
    const entry = Option.flatMap(this.featureFlagService, (service) => service.getVariant(key));
    return Option.getOrNull(
      Option.flatMap(entry, ({ enabled, payload }) =>
        enabled && P.isString(payload) ? Option.some<FeatureFlagValue<K>>(payload) : Option.none(),
      ),
    );
  }

  getFeatureFlags(keys?: ReadonlyArray<FeatureFlagKey>) {
    if (this.isInert) return Promise.resolve(NO_FLAGS);
    return this.whenReady(() =>
      this.runEffect(getFeatureFlagsEffect(keys), "FAILED_TO_GET_FEATURE_FLAGS"),
    );
  }

  refreshFeatureFlags(keys?: ReadonlyArray<FeatureFlagKey>) {
    if (this.isInert) return Promise.resolve(NO_FLAGS);
    return this.whenReady(() =>
      this.runEffect(refreshFeatureFlagsEffect(keys), "FAILED_TO_REFRESH_FEATURE_FLAGS"),
    );
  }

  /**
   * Links the current visitor to your user id. The device switches at once;
   * the link that merges the anonymous visitor into the user is stored and
   * delivered in the background, retried until Voidhash confirms it, so the
   * call never waits for or fails on the network. Events keep the id they
   * were recorded with. String `email` and `name` traits also fill the
   * person's built-in fields.
   *
   * Safe to call wherever your app learns who the user is, as often as it
   * does: the same id with the same traits as the last call sends nothing and
   * refreshes no flags. With `grantConsentOnIdentify`, an analytics consent
   * still `pending` is granted first.
   */
  identify(externalUserId: string, traits?: VoidhashTraits): Promise<void> {
    if (this.isInert) return Promise.resolve();
    const invalid = validateUserId(externalUserId);
    if (Option.isSome(invalid)) {
      return Promise.reject(invalid.value);
    }
    return this.limitCallsBeforeInitialize("identify", (waiting) =>
      this.inOrder(() =>
        this.whenReady(
          () =>
            this.runEffect(identifyEffect(externalUserId, traits), "FAILED_TO_IDENTIFY").then(
              (isApplied) => {
                if (isApplied) this.refreshFlagsForNewIdentity();
              },
            ),
          waiting,
        ),
      ),
    );
  }

  /**
   * Starts a new anonymous identity and session on this device, whoever was
   * using it. For a signed-in user it is exactly `signOut()`, `$sign_out`
   * included. For an anonymous visitor, where `signOut()` does nothing, it
   * starts a fresh visitor: a new anonymous id, no groups, a new session, and
   * no event. Use it for a shared device or a guest who starts over, and
   * `signOut()` when a user signs out.
   */
  reset(): Promise<void> {
    if (this.isInert) return Promise.resolve();
    return this.limitCallsBeforeInitialize("reset", (waiting) =>
      this.inOrder(() =>
        this.whenReady(
          () =>
            this.runEffect(resetEffect(), "FAILED_TO_RESET").then(() =>
              this.refreshFlagsForNewIdentity(),
            ),
          waiting,
        ),
      ),
    );
  }

  /**
   * Records `$sign_out` for the current user, then starts a new anonymous
   * identity and session. Events keep the id they were recorded with. Call it
   * after your own sign-out completes. Does nothing when nobody is signed in:
   * the visitor keeps their anonymous id and groups; `reset()` starts a new
   * visitor regardless, and is otherwise the same call.
   *
   * An analytics consent that `identify()` granted, with
   * `grantConsentOnIdentify`, returns to `pending`, after the events recorded
   * so far were sent, which is waited for at most 2 seconds.
   */
  signOut(): Promise<void> {
    if (this.isInert) return Promise.resolve();
    return this.limitCallsBeforeInitialize("signOut", (waiting) =>
      this.inOrder(() =>
        this.whenReady(
          () =>
            this.runEffect(signOutEffect(), "FAILED_TO_SIGN_OUT").then((isSignedOut) => {
              if (isSignedOut) this.refreshFlagsForNewIdentity();
            }),
          waiting,
        ),
      ),
    );
  }

  /**
   * The id of the current analytics session, the one the next event joins.
   * `undefined` before `initialize()` resolves, while analytics consent is not
   * granted, and after 30 minutes without events, until the next event starts
   * a new session.
   */
  // oxlint-disable-next-line effect/prefer-option-over-null -- the public API takes and returns plain values, so callers do not need Effect.
  getSessionId(): string | undefined {
    if (this.state !== "ready") {
      return undefined;
    }
    return Option.getOrUndefined(this.runtime.runSync(getSessionIdEffect()));
  }

  /**
   * Updates the current person's attributes. Reserved `email`/`name` are
   * forwarded as dedicated profile fields; everything else is sent as free-form
   * traits. Fire-and-forget: the write is queued and delivered in the
   * background, as a `$set` analytics event while analytics consent is granted.
   *
   * The attributes are what your app says about the person, so they are written
   * whatever the consent: without it they are sent as a request of their own,
   * stored and retried like an `identify()` link, with nothing the SDK knows
   * about the device. Only agreeing to ad data sharing needs consent: without
   * it, an `$ad_data_sharing` other than `false` is left out. Withdrawing
   * consent keeps the attributes still queued. Does nothing while
   * `pauseAnalytics()` is in effect.
   */
  setPersonAttributes(attributes: VoidhashPersonAttributes): Promise<void> {
    if (this.isInert) return Promise.resolve();
    return this.limitCallsBeforeInitialize("setPersonAttributes", (waiting) =>
      this.whenReady(
        () =>
          this.runEffect(setPersonAttributesEffect(attributes), "FAILED_TO_SET_PERSON_ATTRIBUTES"),
        waiting,
      ),
    );
  }

  /**
   * Puts the end user in a group, such as the company or workspace they use your app as part
   * of. Every later event carries it in `$groups`, until `resetGroups()`, `reset()` or
   * `signOut()`; it is kept on the device with the user's id, one group per type. `properties`
   * set the group's own properties, such as its `name` and `plan`; they are sent, as a
   * `$groupidentify` event, when given or when the end user's group of that type changed.
   *
   * A group is what your app says about the end user, so it is sent whatever the analytics
   * consent. Without consent the `$groupidentify` is sent at once and on its own, with the group
   * and nothing about the page, the session or the device; it is not stored or retried, so call
   * `group()` or `setGroups()` again if Voidhash could not be reached.
   */
  group(
    groupType: string,
    groupKey: string | number,
    properties?: VoidhashGroupProperties,
  ): Promise<void> {
    if (this.isInert) return Promise.resolve();
    const key = String(groupKey);
    const invalid = invalidGroup(groupType, key);
    if (Option.isSome(invalid)) return Promise.reject(invalid.value);
    return this.limitCallsBeforeInitialize("group", (waiting) =>
      this.inOrder(() =>
        this.whenReady(
          () => this.runEffect(groupEffect(groupType, key, properties), "FAILED_TO_SET_GROUP"),
          waiting,
        ),
      ),
    );
  }

  /**
   * Replaces every group the end user belongs to, by group type: each a group's id, or its id
   * with its properties beside it, as in `{ company: { id: "acme", plan: "pro" }, team: 42 }`. A
   * type left out, or set to `null` or `undefined`, is dropped, and `{}` is `resetGroups()`.
   *
   * Safe to call wherever your app learns the user's groups, as often as it does: a
   * `$groupidentify` is sent only for a group whose id changed or whose properties differ from
   * the ones last sent, so the same call again sends nothing. Groups are sent whatever the
   * analytics consent, as `group()` sends them; one that did not reach Voidhash without consent
   * is sent by the next call. Rejects, changing nothing, when a type or an id
   * is one `group()` refuses.
   */
  setGroups(
    // oxlint-disable-next-line effect/prefer-option-over-null -- the public API takes plain values, so a missing group can be passed as it is.
    groups: Readonly<Record<string, VoidhashGroup | string | number | null | undefined>>,
  ): Promise<void> {
    if (this.isInert) return Promise.resolve();
    const next = R.map(R.filter(groups, P.isNotNullish), (group) => {
      const { id, ...properties } = isJsonObject(group) ? group : { id: group };
      return {
        key: P.isString(id) || P.isNumber(id) ? String(id) : "",
        ...(!R.isEmptyRecord(properties) && { properties }),
      };
    });
    const invalid = Arr.findFirst(R.toEntries(next), ([groupType, group]) =>
      invalidGroup(groupType, group.key),
    );
    if (Option.isSome(invalid)) return Promise.reject(invalid.value);
    return this.limitCallsBeforeInitialize("setGroups", (waiting) =>
      this.inOrder(() =>
        this.whenReady(
          () => this.runEffect(setGroupsEffect(next), "FAILED_TO_SET_GROUPS"),
          waiting,
        ),
      ),
    );
  }

  /** Takes the end user out of every group; later events carry no `$groups`. */
  resetGroups(): Promise<void> {
    if (this.isInert) return Promise.resolve();
    return this.limitCallsBeforeInitialize("resetGroups", (waiting) =>
      this.inOrder(() =>
        this.whenReady(
          () => this.runEffect(resetGroupsEffect(), "FAILED_TO_RESET_GROUPS"),
          waiting,
        ),
      ),
    );
  }

  /**
   * The groups the end user belongs to, by group type, as `group()` set them: `{}` before
   * `initialize()` resolves and when they belong to none.
   */
  getGroups(): Readonly<Record<string, string>> {
    if (this.state !== "ready") return {};
    return { ...this.runtime.runSync(getGroupsEffect()) };
  }

  /**
   * Records whether the end user agreed to you sharing their purchases with ad
   * platforms, as the person trait `$ad_data_sharing`. Voidhash sends a person's
   * purchases to a Conversions API you turned on only when it is `true`.
   *
   * `true` needs analytics consent, unlike other person attributes: it does
   * nothing while consent is not granted. `false` is a revocation, which analytics
   * consent neither blocks nor discards: it is stored on the device and retried
   * until Voidhash has written it, or for 48 hours while Voidhash has no such
   * person, and it records no analytics. When someone rejects
   * everything, call it next to `setAnalyticsConsent("denied")`. Withdrawing
   * analytics consent does not take this back by itself.
   */
  setAdDataSharing(granted: boolean): Promise<void> {
    if (this.isInert) return Promise.resolve();
    return this.limitCallsBeforeInitialize("setAdDataSharing", (waiting) =>
      this.whenReady(
        () => this.runEffect(setAdDataSharingEffect(granted), "FAILED_TO_SET_AD_DATA_SHARING"),
        waiting,
      ),
    );
  }

  /**
   * Synchronously persists the current person's attributes to the server and
   * returns the resulting person snapshot, whatever the analytics consent.
   * Without consent, an `$ad_data_sharing` other than `false` is left out, and
   * with nothing else to write the unchanged person is returned. Without a
   * publishable key there is no person: the snapshot's ids are empty.
   */
  setPersonAttributesSync(attributes: VoidhashPersonAttributes): Promise<VoidhashPerson> {
    if (this.isInert) {
      return Promise.resolve({ distinctId: "", email: null, name: null, personId: "" });
    }
    return this.whenReady(() =>
      this.runEffect(
        setPersonAttributesSyncEffect(attributes),
        "FAILED_TO_SET_PERSON_ATTRIBUTES_SYNC",
      ),
    );
  }

  /**
   * A Google Play link to your app whose `referrer` carries the campaign of the
   * visitor's latest touch and when it happened, so the Android SDK can credit
   * the install to it. It never holds an identity. Without analytics
   * consent, without a touch, and before `initialize()` resolves, it is the
   * plain link. Build it when the visitor follows the link, to carry the latest
   * touch by then.
   */
  playStoreUrl(packageName: string): string {
    const url = `https://play.google.com/store/apps/details?id=${encodeValue(packageName)}`;
    if (this.state !== "ready" || this.analyticsConsent.current() !== "granted") return url;
    const referrer = encodeValue(
      Option.getOrElse(this.runtime.runSync(latestTouchReferrerEffect()), () => ""),
    );
    return referrer === "" ? url : `${url}&referrer=${referrer}`;
  }

  /**
   * Records a product event. Returns at once and never throws: the event is
   * queued, and delivered, retried and stored offline in the background.
   *
   * Call it from anywhere, also before `initialize()`: in a browser the event
   * waits for it. It also waits for the `identify()`, `signOut()`, `reset()`,
   * group and consent calls made before it, so it is recorded for the person
   * the app switched to, without awaiting them. Either way it keeps the time it was called at, unless
   * `options.timestamp` gives another. `flushAnalytics()` sends it too.
   *
   * A blank name is ignored and reported as the `ANALYTICS_EVENT_INVALID`
   * diagnostic; an event that cannot be recorded, as on a server or after
   * `destroy()`, is reported as an `error` event.
   */
  capture(
    eventName: string,
    properties?: Record<string, unknown>,
    options?: VoidhashTrackOptions,
  ): void {
    if (this.isInert) return;
    if (!P.isString(eventName) || !Str.isNonEmpty(eventName.trim())) {
      const diagnostic: VoidhashDiagnostic = {
        code: "ANALYTICS_EVENT_INVALID",
        kind: "eviction",
        message: "Ignored an event with a blank name.",
        operation: "analytics.capture",
        retryable: false,
      };
      // As every diagnostic: a handler that throws cannot break the caller.
      Result.try({ catch: (error) => error, try: () => this.config.onDiagnostic?.(diagnostic) });
      this.eventBus.emit("diagnostic", diagnostic);
      return;
    }
    this.recordEvent("capture", eventName, properties, options).catch((error: unknown) => {
      this.eventBus.emit("error", {
        error,
        message: `capture() could not record ${eventName}.`,
        source: "analytics",
      });
    });
  }

  /**
   * Records a product event, as `capture()` does, and resolves once it is
   * queued. It never rejects because of the network; it rejects for a blank
   * name, on a server, and after `destroy()`.
   * @deprecated Use `capture()`, which returns at once and never throws.
   */
  track(
    eventName: string,
    properties?: Record<string, unknown>,
    options?: VoidhashTrackOptions,
  ): Promise<void> {
    if (this.isInert) return Promise.resolve();
    if (!P.isString(eventName) || !Str.isNonEmpty(eventName.trim())) {
      return Promise.reject(
        new VoidhashInvalidArgumentError("eventName must be a non-blank string."),
      );
    }
    return this.recordEvent("track", eventName, properties, options);
  }

  /**
   * Records a `$pageview`. Page views are recorded automatically unless the
   * `analytics.capturePageViews` option is `false`; call this for views the
   * URL does not reflect. Like `capture()`, it may be called before
   * `initialize()`, and runs after the identity calls made before it.
   */
  page(
    pageName?: string,
    properties?: Record<string, unknown>,
    options?: VoidhashTrackOptions,
  ): Promise<void> {
    if (this.isInert) return Promise.resolve();
    return this.recordEvent(
      "page",
      "$pageview",
      buildPageProperties(pageName, properties),
      options,
    );
  }

  /**
   * Records the end user's analytics consent and applies it immediately. The
   * choice is stored on this device, takes precedence over the
   * `analyticsConsent` option on later visits, survives `reset()`, and reaches
   * other open tabs. Revoking consent discards every queued and in-flight
   * event; granting it again does not replay anything. May be called before
   * `initialize()`.
   *
   * With `analyticsConsentSource: "app"`, the choice still reaches other open
   * tabs, but a later visit starts from the `analyticsConsent` option, and
   * `pending` keeps what is queued and stored until the next answer.
   *
   * With `analyticsWhilePending: "buffer"`, `granted` records the events held
   * while consent was `pending`, and `denied` discards them. Any call makes
   * the choice the end user's own, which `signOut()` and `reset()` then leave
   * alone; see `grantConsentOnIdentify`.
   */
  setAnalyticsConsent(consent: AnalyticsConsent): Promise<void> {
    if (this.isInert) return Promise.resolve();
    if (this.isDestroying()) {
      return Promise.reject(new VoidhashDestroyedError());
    }
    const apply = () => {
      const previousDistinctId = this.peekDistinctId();
      return this.runEffect(
        setAnalyticsConsentEffect(consent),
        "FAILED_TO_SET_ANALYTICS_CONSENT",
      ).then(() => {
        // A grant can move the device onto the anonymous id its subdomains share.
        if (this.peekDistinctId() !== previousDistinctId) this.refreshFlagsForNewIdentity();
      });
    };
    // Before `initialize()` the identity calls made so far wait for it, and a
    // consent tool's answer must not: it applies at once, as it always did.
    return this.state === "idle" ? apply() : this.inOrder(apply);
  }

  /**
   * Stops recording analytics until `resumeAnalytics()`: page views, campaign
   * touches, events, and person attributes. Unlike consent, the pause is not
   * stored and only applies to this client on this page: events already
   * queued stay queued and are still sent, and nothing is recorded later for
   * the time it lasted. Takes effect at once, so a router or a History hook
   * can call it before it navigates to a page that must not be recorded; keep
   * it paused while the visitor is on that page, as its page view is recorded
   * just after the navigation. Works before `initialize()`.
   */
  pauseAnalytics(): void {
    this.analyticsConsent.setPaused(true);
  }

  /**
   * Records analytics again after `pauseAnalytics()`. Records nothing by
   * itself: the page the visitor is on is recorded with their next navigation,
   * or call `page()`.
   */
  resumeAnalytics(): void {
    this.analyticsConsent.setPaused(false);
  }

  /** Whether `pauseAnalytics()` stopped recording. */
  isAnalyticsPaused(): boolean {
    return this.analyticsConsent.isPaused();
  }

  /**
   * The analytics consent the client was configured to start with, before a
   * choice stored in the browser is read. The React bindings render it on the
   * server and during hydration, so the server and the first client render
   * agree.
   * @internal
   */
  getConfiguredAnalyticsConsent(): AnalyticsConsent {
    return this.config.analytics.enabled ? this.config.analyticsConsent : "denied";
  }

  /**
   * What a flag reads as while it has no evaluated value: its
   * `featureFlags.defaults` entry, or `false`. The React hook reads it, also
   * before the client is ready.
   * @internal
   */
  isFeatureEnabledByDefault(key: string): boolean {
    return isEnabledByDefault(this.config.featureFlags.defaults, key);
  }

  /**
   * Analytics consent currently in effect. Always `denied` while the
   * `analytics.enabled` option is `false`. Before `initialize()` resolves this
   * reflects the option, not yet a stored choice.
   */
  getAnalyticsConsent(): AnalyticsConsent {
    return this.analyticsConsent.current();
  }

  /**
   * Sends queued identity writes, then queued analytics. Resolves with the
   * analytics flush status and never rejects because of transport: what
   * failed stays queued for the next attempt. Waits at most 2 seconds; when
   * Voidhash is slower, it resolves with what was delivered so far and what
   * is still pending, and delivery carries on in the background. Events
   * `capture()` accepted that still wait for an identity call are sent too.
   * Calling it before `initialize` or after `destroy` still rejects, because
   * that is a programmer error rather than an outage.
   */
  flushAnalytics(): Promise<AnalyticsFlushStatus> {
    if (this.isInert) return Promise.resolve({ flushed: 0, pending: 0 });
    // The steps report their own coded errors, so the bound adds none.
    return this.whenReady(() =>
      this.runtime.runPromise(
        boundedFlushEffect(
          fromPromise(() =>
            Promise.allSettled(this.eventsNotQueued)
              .then(() => this.runEffect(flushIdentityEffect(), "FAILED_TO_FLUSH_IDENTITY"))
              .then(() => this.flushAnalyticsInternal()),
          ),
        ),
      ),
    );
  }

  /**
   * Subscribes to SDK diagnostics. Equivalent to the `onDiagnostic` option and
   * to `on("diagnostic", handler)`.
   */
  onDiagnostic(handler: (diagnostic: VoidhashDiagnostic) => void) {
    return this.eventBus.on("diagnostic", handler);
  }

  on<TEvent extends VoidhashEventName>(
    eventName: TEvent,
    handler: (payload: VoidhashEventMap[TEvent]) => void,
  ) {
    return this.eventBus.on(eventName, handler);
  }

  off<TEvent extends VoidhashEventName>(
    eventName: TEvent,
    handler: (payload: VoidhashEventMap[TEvent]) => void,
  ) {
    this.eventBus.off(eventName, handler);
  }

  /**
   * Evaluates the tracked flags again for the identity just switched to. In
   * the background: a slow network must not hold up identify or sign-out.
   */
  private refreshFlagsForNewIdentity() {
    void this.runEffect(refreshTrackedKeySetsEffect(), "FAILED_TO_REFRESH_FLAGS").catch((error) => {
      this.eventBus.emit("error", {
        error,
        message: "Refreshing feature flags for the new identity failed.",
        source: "feature-flags",
      });
    });
  }

  /**
   * Runs the calls that change who the end user is, their groups or their
   * consent one after another, in the order they were made, so an app need not
   * await one before it makes the next. A call made while none is running
   * starts at once.
   */
  private inOrder<T>(run: () => Promise<T>): Promise<T> {
    const result = this.unsettledIdentityCalls === 0 ? run() : this.lastIdentityCall.then(run);
    this.unsettledIdentityCalls += 1;
    const settle = () => {
      this.unsettledIdentityCalls -= 1;
    };
    this.lastIdentityCall = result.then(settle, settle);
    return result;
  }

  /**
   * Queues an event once the client is ready and the identity calls made
   * before it settled, so it is recorded for the person the app switched to.
   * It does not join those calls: an event never holds up a later
   * `identify()`. It keeps the time it was called at.
   */
  private recordEvent(
    method: Extract<MethodBeforeInitialize, "capture" | "page" | "track">,
    eventName: string,
    properties?: Record<string, unknown>,
    options?: VoidhashTrackOptions,
  ): Promise<void> {
    const timedOptions = {
      ...options,
      // oxlint-disable-next-line effect/use-clock-service -- the time of the app's call, outside any Effect.
      timestamp: options?.timestamp ?? new Date().toISOString(),
    };
    const recorded = this.limitCallsBeforeInitialize(method, (waiting) => {
      const record = () =>
        this.whenReady(
          () =>
            this.runEffect(
              trackEffect(eventName, properties, timedOptions),
              "FAILED_TO_TRACK",
            ).then((queued) => {
              // A full batch goes out at once, without making the caller wait.
              if (Option.exists(queued, (length) => length >= this.config.analytics.maxBatchSize)) {
                this.flushInBackground();
              }
            }),
          waiting,
        );
      if (this.unsettledIdentityCalls > 0) this.eventGate = this.lastIdentityCall;
      else if (this.eventsBehindGate === 0) return record();
      // Behind the identity calls made before it, or behind the events that
      // still wait for those: callbacks of one promise run in the order added.
      this.eventsBehindGate += 1;
      return this.eventGate.then(() => {
        this.eventsBehindGate -= 1;
        return record();
      });
    });
    this.eventsNotQueued.add(recorded);
    const forget = () => {
      this.eventsNotQueued.delete(recorded);
    };
    void recorded.then(forget, forget);
    return recorded;
  }

  /**
   * Counts a call made before `initialize()` in a browser, which waits for it,
   * and rejects it past {@link MAX_CALLS_BEFORE_INITIALIZE}.
   */
  private limitCallsBeforeInitialize<T>(
    method: MethodBeforeInitialize,
    call: (waiting: CallBeforeInitialize) => Promise<T>,
  ): Promise<T> {
    // Checked as the call is made: while `destroy()` waits for the events
    // made before it, a call made after it must not join them.
    if (this.isDestroying()) return Promise.reject(new VoidhashDestroyedError());
    if (this.state === "idle" && hasBrowser()) {
      if (this.callsBeforeInitialize >= MAX_CALLS_BEFORE_INITIALIZE) {
        return Promise.reject(
          new VoidhashNotInitializedError(
            `${method}() was called before initialize(), with ${MAX_CALLS_BEFORE_INITIALIZE} calls already waiting for it.`,
          ),
        );
      }
      this.callsBeforeInitialize += 1;
    }
    return call({ failedStarts: this.failedStarts });
  }

  /** `true` from the moment `destroy()` is called, not only once it finished. */
  private isDestroying() {
    return this.state === "destroyed" || Option.isSome(this.destroyPromise);
  }

  /** Flushes without anyone waiting; a failure is reported as an `error` event. */
  private flushInBackground() {
    void this.flushAnalyticsInternal().catch((error) => {
      this.eventBus.emit("error", {
        error,
        message: "Background analytics flush failed.",
        source: "analytics",
      });
    });
  }

  private flushAnalyticsInternal(): Promise<AnalyticsFlushStatus> {
    if (Option.isSome(this.inFlightFlush)) return this.inFlightFlush.value;

    const inFlightFlush = this.runEffect(
      flushAnalyticsEffect(),
      "FAILED_TO_FLUSH_ANALYTICS",
    ).finally(() => {
      this.inFlightFlush = Option.none();
    });
    this.inFlightFlush = Option.some(inFlightFlush);

    return inFlightFlush;
  }

  /**
   * Runs `run` once the client is ready. A call made while `initialize()` is
   * running waits for it, so an event tracked during page load is kept. With
   * `waiting`, so does a call made before `initialize()` in a browser, until
   * `initialize()` is called, unless a start made since the call failed: the
   * call is then rejected with that start's error, wherever it was waiting.
   * Otherwise, and on a server, a call before `initialize()` rejects, as does
   * one after `destroy()`.
   * The check happens before the runtime is touched so a call after `destroy`
   * reports the SDK error rather than a disposed-runtime failure.
   */
  private whenReady<T>(run: () => Promise<T>, waiting?: CallBeforeInitialize): Promise<T> {
    if (this.isDestroying() && !(this.isDrainingEvents && waiting !== undefined)) {
      return Promise.reject(new VoidhashDestroyedError());
    }

    if (this.state === "initializing" && Option.isSome(this.initializePromise)) {
      return this.initializePromise.value.then(() => this.whenReady(run, waiting));
    }

    if (this.state === "idle" && waiting !== undefined && hasBrowser()) {
      if (this.failedStarts > waiting.failedStarts) return Promise.reject(this.lastStartFailure);
      return new Promise<T>((resolve, reject) => {
        this.waitingForInitialize.push({
          proceed: () => {
            this.whenReady(run, waiting).then(resolve, reject);
          },
          reject,
        });
      });
    }

    if (this.state !== "ready") {
      return Promise.reject(new VoidhashNotInitializedError());
    }

    return this.runtime.runPromise(fromPromise(run));
  }

  private get ensureReady(): Effect.Effect<void, VoidhashError> {
    if (this.isDestroying()) {
      return Effect.fail(new VoidhashDestroyedError());
    }

    if (this.state !== "ready") {
      return Effect.fail(new VoidhashNotInitializedError());
    }

    return Effect.void;
  }

  private attachBrowserListeners(config: ReturnType<typeof resolveVoidhashConfig>) {
    if (P.isUndefined(globalThis.window)) {
      return;
    }

    const refreshFlags = () => {
      // oxlint-disable-next-line effect/use-clock-service -- plain debounce in a DOM event handler outside any Effect; the client wrapper has no Clock in scope here.
      const now = Date.now();
      if (now - this.lastRefreshAt < REFRESH_DEBOUNCE_MS) {
        return;
      }
      this.lastRefreshAt = now;
      void this.runEffect(refreshTrackedKeySetsEffect(), "FAILED_TO_REFRESH_FLAGS").catch(() => {});
    };

    const flushQueued = () => {
      void this.runEffect(retryIdentityEffect(), "FAILED_TO_RETRY_IDENTITY").catch(() => {});
      void this.runEffect(resetAnalyticsBackoffEffect(), "FAILED_TO_RESET_BACKOFF")
        .then(() => this.flushAnalyticsInternal())
        .catch(() => {});
    };

    // Connectivity restored: probe any open circuit, drain the queue, then
    // refresh configuration.
    const onlineHandler = () => {
      void this.runEffect(halfOpenCircuitsEffect(), "FAILED_TO_RESET_CIRCUITS").catch(() => {});
      flushQueued();
      if (config.featureFlags.refreshOnOnline) {
        refreshFlags();
      }
    };

    // One effect, so the `$pageleave` is queued before the request that carries
    // the queue out of the closing page starts.
    const pageHideHandler = (event: PageTransitionEvent) => {
      void this.runEffect(
        Effect.andThen(this.closePageView(), leavePageEffect({ isUnloading: !event.persisted })),
        "FAILED_TO_FLUSH",
      ).catch(() => {});
    };

    // Another tab changed analytics consent; this one must follow it, so a
    // revoked consent stops capturing everywhere. A grant there can also bring
    // that tab's identity onto the device, which this tab then takes on.
    const followConsent = () => {
      void this.runEffect(syncAnalyticsConsentEffect(), "FAILED_TO_SYNC_ANALYTICS_CONSENT").then(
        () => this.followIdentity(),
        (error) => {
          this.eventBus.emit("error", {
            error,
            message: "Applying analytics consent from another tab failed.",
            source: "analytics",
          });
        },
      );
    };

    // A page restored from the back/forward cache missed the `storage` events
    // of the time it was frozen, and would undo a withdrawal made meanwhile.
    // With the app as the source, a page still waiting for its answer records
    // nothing, and must not take an earlier answer for it.
    const pageShowHandler = (event: PageTransitionEvent) => {
      const isWaitingForApp =
        config.analyticsConsentSource === "app" && this.analyticsConsent.current() === "pending";
      if (event.persisted && !isWaitingForApp) followConsent();
    };

    const storageHandler = (event: StorageEvent) => {
      if (event.key?.endsWith(`:${DISTINCT_ID_KEY}`)) {
        void this.followIdentity();
        return;
      }
      if (event.key?.endsWith(`:${GROUPS_KEY}`)) {
        void this.runEffect(syncGroupsEffect(), "FAILED_TO_FOLLOW_GROUPS").catch(() => {});
        return;
      }
      if (event.key?.includes(":analytics:queue:")) {
        void this.runEffect(otherQueueChangedEffect(), "FAILED_TO_FOLLOW_QUEUES").catch(() => {});
        return;
      }
      if (!event.key?.endsWith(`:${ANALYTICS_CONSENT_KEY}`)) {
        return;
      }
      followConsent();
    };

    const visibilityHandler = () => {
      if (P.isUndefined(globalThis.document)) return;
      if (document.visibilityState === "hidden") {
        void this.runEffect(persistAnalyticsEffect(), "FAILED_TO_PERSIST_ANALYTICS").catch(
          () => {},
        );
        return;
      }
      if (document.visibilityState !== "visible") {
        return;
      }
      void this.runEffect(halfOpenCircuitsEffect(), "FAILED_TO_RESET_CIRCUITS").catch(() => {});
      flushQueued();
      if (config.featureFlags.refreshOnVisibility) {
        refreshFlags();
      }
    };

    window.addEventListener("online", onlineHandler);
    window.addEventListener("pagehide", pageHideHandler);
    window.addEventListener("pageshow", pageShowHandler);
    window.addEventListener("storage", storageHandler);
    this.listeners.push(() => window.removeEventListener("online", onlineHandler));
    this.listeners.push(() => window.removeEventListener("pagehide", pageHideHandler));
    this.listeners.push(() => window.removeEventListener("pageshow", pageShowHandler));
    this.listeners.push(() => window.removeEventListener("storage", storageHandler));

    if (!P.isUndefined(globalThis.document)) {
      document.addEventListener("visibilitychange", visibilityHandler);
      this.listeners.push(() =>
        document.removeEventListener("visibilitychange", visibilityHandler),
      );
    }
  }

  /**
   * Another tab identified, signed out, or stored the identity its visitor
   * consented under; this one must follow, so it does not keep recording under
   * a user who is gone.
   */
  private followIdentity() {
    return this.runEffect(syncIdentityEffect(), "FAILED_TO_SYNC_IDENTITY").then(
      (changed) => {
        if (changed) this.refreshFlagsForNewIdentity();
      },
      (error) => {
        this.eventBus.emit("error", {
          error,
          message: "Following an identity change from another tab failed.",
          source: "identity",
        });
      },
    );
  }

  /**
   * Records the current page now, after every client-side navigation, and
   * when analytics consent is granted later, which sends the campaign touches
   * held while consent was pending.
   *
   * While analytics consent is granted it also measures the page view on
   * screen, for the `$pageleave` that ends it, and watches for outbound clicks.
   * Without consent nothing listens, measures, or is kept.
   *
   * A page view ends with a client-side navigation, as the page closes, or when
   * the client stops. Being hidden does not end it, as the visitor may return,
   * but it may be the last the page sees: browsers discard a hidden page,
   * especially on phones, without another event. So the `$pageleave` is queued
   * then as provisional: stored, for the next page to send, but not sent, and
   * dropped when the visitor returns.
   */
  private attachPageTracking(config: ReturnType<typeof resolveVoidhashConfig>) {
    const { captureOutboundClicks, capturePageLeaves, capturePageViews } = config.analytics;
    const isGranted = () => this.analyticsConsent.current() === "granted";

    const runInBackground = (effect: Effect.Effect<unknown, unknown, SdkServices>) => {
      void this.runEffect(effect, "FAILED_TO_RECORD_PAGE").catch((error) => {
        this.eventBus.emit("error", {
          error,
          message: "Recording the page view failed.",
          source: "analytics",
        });
      });
    };

    // Whether the page view of the page the visitor is on was recorded under
    // consent and kept, or is held for the answer. A `pending` that only waits
    // for the app's answer keeps it, so `granted` after it must not count the
    // page again.
    let isPageRecorded = false;
    const isHeldForAnswer = () =>
      config.analyticsWhilePending === "buffer" && this.analyticsConsent.current() === "pending";
    // `before` runs in the same effect, so what it records goes first.
    const recordPage = (
      pageView: boolean,
      before: Effect.Effect<void, unknown, SdkServices> = Effect.void,
    ) => {
      if (pageView) isPageRecorded = isGranted() || isHeldForAnswer();
      runInBackground(Effect.andThen(before, recordPageEffect({ pageView })));
    };

    // Whether the next page view can report the load: the document's first,
    // until a navigation or a withdrawn consent.
    let isLanding = true;
    let openView = Option.none<{
      readonly context: PageViewContext;
      readonly measurement: ReturnType<typeof measurePageView>;
    }>();
    let isLeaveProvisional = false;

    const onHidden = () => {
      if (Option.isNone(openView) || isLeaveProvisional) return;
      isLeaveProvisional = true;
      const { context, measurement } = openView.value;
      runInBackground(recordPageLeaveEffect(context, measurement.read(), true));
    };

    const onVisible = () => {
      if (!isLeaveProvisional) return;
      isLeaveProvisional = false;
      runInBackground(settleProvisionalLeaveEffect("drop"));
    };

    const openPageView = () =>
      capturePageLeaves && isGranted()
        ? Effect.map(readPageViewContextEffect(), (context) => {
            openView = Option.map(context, (value) => ({
              context: value,
              measurement: measurePageView({ isLanding, onHidden, onVisible }),
            }));
          })
        : Effect.void;

    // Reads and flips the state now rather than when the effect runs, so
    // `visibilitychange` and `pagehide` can never both record it.
    const closePageView = () => {
      const closing = openView;
      const wasProvisional = isLeaveProvisional;
      openView = Option.none();
      isLeaveProvisional = false;
      if (Option.isNone(closing)) return Effect.void;
      const { context, measurement } = closing.value;
      const engagement = measurement.read();
      measurement.stop();
      return wasProvisional
        ? settleProvisionalLeaveEffect("send")
        : recordPageLeaveEffect(context, engagement);
    };
    this.closePageView = closePageView;

    let stopOutboundClicks = () => {};
    const followConsent = () => {
      stopOutboundClicks();
      stopOutboundClicks =
        captureOutboundClicks && isGranted()
          ? observeOutboundClicks((origin) => runInBackground(recordOutboundClickEffect(origin)))
          : () => {};
    };
    followConsent();
    this.listeners.push(() => stopOutboundClicks());

    this.listeners.push(
      this.eventBus.on("analytics-consent-changed", ({ consent }) => {
        if (
          consent === "denied" ||
          (consent === "pending" && config.analyticsConsentSource === "sdk")
        ) {
          isPageRecorded = false;
        }
        followConsent();
        if (consent !== "granted") {
          // Revoked: what was measured goes, and what the browser buffers from
          // here on is not read back later.
          Option.map(openView, ({ measurement }) => measurement.stop());
          openView = Option.none();
          isLeaveProvisional = false;
          isLanding = false;
        }
        if (consent === "denied") recordPage(false, openPageView());
        // A grant made in another tab comes with that tab's identity, which is
        // the one this page, the touches it holds and the events held for the
        // answer must be recorded under.
        if (consent === "granted") {
          void this.followIdentity().then(() =>
            recordPage(
              capturePageViews && !isPageRecorded,
              Effect.andThen(replayBufferedEffect(), openPageView()),
            ),
          );
        }
      }),
    );
    // A navigation that only changes the query is recorded for its campaign
    // touch, not as another page view.
    this.listeners.push(
      observeNavigation(({ pathChanged }) => {
        if (!pathChanged) {
          recordPage(false);
          return;
        }
        isLanding = false;
        recordPage(capturePageViews, Effect.andThen(closePageView(), openPageView()));
      }),
    );
    recordPage(capturePageViews, openPageView());
  }

  private detachBrowserListeners() {
    this.listeners.splice(0).forEach((cleanup) => cleanup());
  }
}

export const createVoidhashClient = (options: VoidhashClientOptions) =>
  new VoidhashWebClient(options);

export type {
  AnalyticsConsent,
  AnalyticsFlushResult,
  AnalyticsFlushStatus,
  FeatureFlagsResult,
  VoidhashClientOptions,
  VoidhashDiagnostic,
  VoidhashTrackOptions,
};
