import * as P from "effect/Predicate";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { VoidhashDestroyedError, VoidhashError, VoidhashNotInitializedError } from "./errors";
import {
  CreateEffectRuntime,
  flushAnalyticsEffect,
  flushAnalyticsKeepaliveEffect,
  getFeatureFlagsEffect,
  identifyEffect,
  initializeEffect,
  refreshFeatureFlagsEffect,
  refreshTrackedKeySetsEffect,
  resetEffect,
  resolveVoidhashConfig,
  setPersonAttributesEffect,
  setPersonAttributesSyncEffect,
  startAnalyticsEffect,
  stopAnalyticsEffect,
  trackEffect,
} from "./client-effect";
import { EventBus } from "./core/event-bus";
import { FeatureFlagService } from "./core/feature-flags/feature-flag-service";
import { IdentityManager } from "./core/identity/identity-manager";
import type {
  AnalyticsFlushResult,
  FeatureFlagsResult,
  VoidhashClientOptions,
  VoidhashEventMap,
  VoidhashEventName,
  VoidhashPersonAttributes,
  VoidhashTrackOptions,
  VoidhashTraits,
} from "./types";

type ClientState = "destroyed" | "idle" | "initializing" | "ready";

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

const buildPageProperties = (pageName?: string, properties?: Record<string, unknown>) => {
  if (!pageName) {
    return properties;
  }
  return { ...properties, page_name: pageName };
};

export class VoidhashWebClient {
  private readonly eventBus: EventBus;
  private readonly runtime: ReturnType<typeof CreateEffectRuntime>;
  private state: ClientState = "idle";
  private initializePromise = Option.none<Promise<void>>();
  private listeners: Array<() => void> = [];
  private inFlightFlush = Option.none<Promise<Option.Option<AnalyticsFlushResult>>>();

  // Service references for sync access (set during init)
  private featureFlagService = Option.none<FeatureFlagService["Service"]>();
  private identityManagerService = Option.none<IdentityManager["Service"]>();

  constructor(private readonly options: VoidhashClientOptions) {
    const config = resolveVoidhashConfig(options);
    this.eventBus = new EventBus();
    this.runtime = CreateEffectRuntime(config, this.eventBus);
  }

  // Effect requires service type parameter
  private runEffect<T>(effect: Effect.Effect<T, unknown, any>, errorCode: string): Promise<T> {
    return this.runtime.runPromise(withErrorCode(effect, errorCode));
  }

  initialize(): Promise<void> {
    if (this.state === "destroyed") {
      return this.runtime.runPromise(Effect.fail(new VoidhashDestroyedError()));
    }

    if (this.state === "ready") {
      return this.runtime.runPromise(Effect.void);
    }

    if (Option.isSome(this.initializePromise)) {
      return this.initializePromise.value;
    }

    this.state = "initializing";
    const config = resolveVoidhashConfig(this.options);

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

          if (config.analytics.enabled) {
            yield* withErrorCode(startAnalyticsEffect(), "FAILED_TO_START_ANALYTICS");

            // Handle scheduled flush events from the analytics service timer
            this.eventBus.on("analytics-flush-needed", () => {
              void this.flushAnalyticsInternal().catch((error) => {
                this.eventBus.emit("error", {
                  error,
                  message: "Scheduled analytics flush failed.",
                  source: "analytics",
                });
              });
            });
          }

          this.attachBrowserListeners(config);

          if (config.featureFlags.prefetchOnInit) {
            yield* withErrorCode(getFeatureFlagsEffect(), "FAILED_TO_PREFETCH_FLAGS");
          }

          const initializedDistinctId = yield* Option.match(distinctId, {
            onNone: () => Effect.die("Identity manager did not produce a distinct id."),
            onSome: Effect.succeed,
          });
          this.eventBus.emit("initialized", { distinctId: initializedDistinctId });
          this.state = "ready";
        }),
      )
      .finally(() => {
        this.initializePromise = Option.none();
      });
    this.initializePromise = Option.some(initializePromise);

    return initializePromise;
  }

  destroy(): Promise<void> {
    return this.runtime.runPromise(
      Effect.gen({ self: this }, function* destroyClient() {
        if (this.state === "destroyed") {
          return;
        }

        if (this.state === "initializing" && Option.isSome(this.initializePromise)) {
          const pending = this.initializePromise.value;
          yield* fromPromise(() => pending);
        }

        this.detachBrowserListeners();

        const config = resolveVoidhashConfig(this.options);
        if (config.analytics.enabled) {
          // Best effort
          yield* Effect.ignore(fromPromise(() => this.flushAnalyticsInternal()));
          yield* fromPromise(() =>
            this.runEffect(stopAnalyticsEffect(), "FAILED_TO_STOP_ANALYTICS"),
          );
        }

        this.state = "destroyed";
      }),
    ).then(() => this.runtime.dispose());
  }

  getDistinctId() {
    if (this.state !== "ready") {
      return Option.none();
    }
    return Option.flatMap(this.identityManagerService, (service) => service.getDistinctId());
  }

  isFeatureEnabled(key: string) {
    return this.runtime.runSync(
      Effect.flatMap(this.ensureReady, () =>
        Option.isSome(this.featureFlagService)
          ? Effect.succeed(this.featureFlagService.value.isEnabled(key))
          : Effect.die("Feature flag service is unavailable after initialization."),
      ),
    );
  }

  getFeatureVariant(key: string) {
    return this.runtime.runSync(
      Effect.flatMap(this.ensureReady, () =>
        Option.isSome(this.featureFlagService)
          ? Effect.succeed(this.featureFlagService.value.getVariant(key))
          : Effect.die("Feature flag service is unavailable after initialization."),
      ),
    );
  }

  getFeatureFlags(keys?: string[]) {
    return this.whenReady(() =>
      this.runEffect(getFeatureFlagsEffect(keys), "FAILED_TO_GET_FEATURE_FLAGS"),
    );
  }

  refreshFeatureFlags(keys?: string[]) {
    return this.whenReady(() =>
      this.runEffect(refreshFeatureFlagsEffect(keys), "FAILED_TO_REFRESH_FEATURE_FLAGS"),
    );
  }

  identify(externalUserId: string, traits?: VoidhashTraits) {
    return this.whenReady(() =>
      this.runEffect(identifyEffect(externalUserId, traits), "FAILED_TO_IDENTIFY"),
    );
  }

  reset() {
    return this.whenReady(() => this.runEffect(resetEffect(), "FAILED_TO_RESET"));
  }

  /**
   * Updates the current person's attributes by enqueuing a `$set` analytics
   * event. Reserved `email`/`name` are forwarded as dedicated profile fields;
   * everything else is sent as free-form traits. Fire-and-forget — the event is
   * queued and flushed by the normal analytics pipeline.
   */
  setPersonAttributes(attributes: VoidhashPersonAttributes) {
    return this.whenReady(() =>
      this.runEffect(setPersonAttributesEffect(attributes), "FAILED_TO_SET_PERSON_ATTRIBUTES"),
    );
  }

  /**
   * Synchronously persists the current person's attributes to the server and
   * returns the resulting person snapshot.
   */
  setPersonAttributesSync(attributes: VoidhashPersonAttributes) {
    return this.whenReady(() =>
      this.runEffect(
        setPersonAttributesSyncEffect(attributes),
        "FAILED_TO_SET_PERSON_ATTRIBUTES_SYNC",
      ),
    );
  }

  track(eventName: string, properties?: Record<string, unknown>, options?: VoidhashTrackOptions) {
    return this.whenReady(() =>
      this.runEffect(trackEffect(eventName, properties, options), "FAILED_TO_TRACK"),
    );
  }

  page(pageName?: string, properties?: Record<string, unknown>, options?: VoidhashTrackOptions) {
    return this.whenReady(() =>
      this.track("page", buildPageProperties(pageName, properties), options),
    );
  }

  flushAnalytics(): Promise<Option.Option<AnalyticsFlushResult>> {
    return this.whenReady(() => this.flushAnalyticsInternal());
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

  private flushAnalyticsInternal(): Promise<Option.Option<AnalyticsFlushResult>> {
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

  /** Runs `run` only once the client is ready, rejecting with the state error otherwise. */
  private whenReady<T>(run: () => Promise<T>): Promise<T> {
    return this.runtime.runPromise(Effect.flatMap(this.ensureReady, () => fromPromise(run)));
  }

  private get ensureReady(): Effect.Effect<void, VoidhashError> {
    if (this.state === "destroyed") {
      return Effect.fail(new VoidhashDestroyedError());
    }

    if (this.state !== "ready") {
      return Effect.fail(new VoidhashNotInitializedError());
    }

    return Effect.void;
  }

  private attachBrowserListeners(config: ReturnType<typeof resolveVoidhashConfig>) {
    if (P.isUndefined(window)) {
      return;
    }

    const onlineHandler = () => {
      if (config.featureFlags.refreshOnOnline) {
        void this.runEffect(refreshTrackedKeySetsEffect(), "FAILED_TO_REFRESH_FLAGS").catch(
          () => {},
        );
      }
    };

    const pageHideHandler = () => {
      if (config.analytics.enabled) {
        void this.runEffect(flushAnalyticsKeepaliveEffect(), "FAILED_TO_FLUSH").catch(() => {});
      }
    };

    const visibilityHandler = () => {
      if (
        config.featureFlags.refreshOnVisibility &&
        !P.isUndefined(document) &&
        document.visibilityState === "visible"
      ) {
        void this.runEffect(refreshTrackedKeySetsEffect(), "FAILED_TO_REFRESH_FLAGS").catch(
          () => {},
        );
      }
    };

    window.addEventListener("online", onlineHandler);
    window.addEventListener("pagehide", pageHideHandler);
    this.listeners.push(() => window.removeEventListener("online", onlineHandler));
    this.listeners.push(() => window.removeEventListener("pagehide", pageHideHandler));

    if (!P.isUndefined(document)) {
      document.addEventListener("visibilitychange", visibilityHandler);
      this.listeners.push(() =>
        document.removeEventListener("visibilitychange", visibilityHandler),
      );
    }
  }

  private detachBrowserListeners() {
    this.listeners.splice(0).forEach((cleanup) => cleanup());
  }
}

export const createVoidhashClient = (options: VoidhashClientOptions) =>
  new VoidhashWebClient(options);

export type {
  AnalyticsFlushResult,
  FeatureFlagsResult,
  VoidhashClientOptions,
  VoidhashTrackOptions,
};
