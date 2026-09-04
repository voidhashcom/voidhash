import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Result from "effect/Result";
import * as Arr from "effect/Array";
import * as MutableRef from "effect/MutableRef";
import * as Option from "effect/Option";
import { AtomRegistry } from "effect/unstable/reactivity";

import { AUTOMATIC_EVENTS } from "./core/analytics/constants";
import { AnalyticsService } from "./core/analytics/service";
import { AnalyticsSessionManager } from "./core/analytics/session-manager";
import type { AnalyticsIngestEvent } from "./core/analytics/types";
import type { Product } from "./core/entities/product";
import type { Transaction } from "./core/entities/transaction";
import { FeatureFlagService } from "./core/feature-flags/feature-flag-service";
import {
  type PersonAttributes,
  PersonAttributeManager,
} from "./core/identity/person-attribute-manager";
import type { SdkPerson } from "@voidhash/generated-clients";
import { IdentityEpoch } from "./core/identity/identity-epoch";
import { PersonInfoManager } from "./core/identity/person-info-manager";
import { type IdentifyOutcome, IdentityManager } from "./core/identity/identity-manager";
import { LifecycleService } from "./core/lifecycle/lifecycle-service";
import { httpStatusOf, IDENTIFY_FLUSH_BUDGET_MS, isRetryableStatus } from "./core/network/policy";
import { PaymentAdapter } from "./core/payment-adapters/payment-adapter";
import { buildPaywallRuntimeConfig } from "./core/paywalls/paywall-runtime-config";
import { type PaywallReleaseRuntime, PaywallService } from "./core/paywalls/paywall-service";
import { PlatformProvider } from "./core/platform/platform-provider";
import { ProductService, type ProductsBySlug } from "./core/products/product-service";
import { currentPersonAtom } from "./core/reactivity/client-state";
import type { LocationSlug } from "./core/schema/registry";
import type { RuntimeSchema } from "./core/schema/runtime";
import { SchemaManager } from "./core/schema/schema-manager";
import { TransactionService } from "./core/transactions/transaction-service";
import { TransactionOutbox } from "./core/transactions/transaction-outbox";
import * as Cause from "effect/Cause";

import { AuthGate } from "./core/network/auth-gate";
import { CircuitBreaker } from "./core/network/circuit-breaker";
import { Diagnostics, DIAGNOSTIC_CODES } from "./core/diagnostics/diagnostics";
import { Connectivity } from "./core/network/connectivity";
import { findActiveGrant } from "./core/entitlements/find-grant";
import type { PerkSlug } from "./core/schema/registry";
import { AuthenticationFailedError, UnsupportedPlatformError } from "./errors";

export type { ProductsBySlug };
export type { AnalyticsIngestEvent };
export type { PersonAttributes };
export type { IdentifyOutcome };

/** The identify options the `$identify` event carries when the switch is deferred. */
interface IdentifyOptions {
  readonly email?: string;
  readonly name?: string;
}

/**
 * Queues the `$identify` event that lets the server perform a deferred
 * identity switch once the queue drains. Same shape as the iOS and Android
 * SDKs emit, so the server handles every platform alike.
 */
const captureDeferredIdentify = (
  analyticsService: typeof AnalyticsService.Service,
  outcome: Extract<IdentifyOutcome, { status: "deferred" }>,
  distinctId: string,
  options: IdentifyOptions,
) =>
  analyticsService.capture(AUTOMATIC_EVENTS.IDENTIFY, {
    $anon_distinct_id: outcome.previousDistinctId,
    $distinct_id: distinctId,
    ...(options.email !== undefined ? { $email: options.email } : {}),
    ...(options.name !== undefined ? { $name: options.name } : {}),
    $process_person_profile: true,
  });

interface InitOptions {
  readonly distinctId?: string;
  /** Placements to warm on first launch, before any of them has resolved. */
  readonly preloadPlacements?: ReadonlyArray<string>;
  readonly preloadPaywallAsset?: (locationSlug: string, htmlUrl: string) => Promise<unknown>;
  /**
   * Test/internal escape hatch — inject a known runtime schema instead of
   * fetching from the server. Not part of the public API. Lets the test
   * suite drive product fetching deterministically while the server-side
   * schema endpoint is still being built out.
   */
  readonly internalSchema?: RuntimeSchema;
}

/**
 * Build the initial state of the SDK before `init()` has run. Returns an
 * object whose `init` method establishes identity, resolves the runtime
 * schema (via `SchemaManager`'s stale-while-revalidate cache), and yields
 * the fully-initialized client facade. The independent network calls are
 * run concurrently via `Effect.all({ concurrency: "unbounded" })`.
 *
 * Nothing the server does fails `init`: a cold cache on an unreachable server
 * boots on an empty schema and no person snapshot, and the background refresh
 * fills both in once the server answers. A provided `distinctId` is adopted
 * locally even when the server refuses the alias; the refusal is reported
 * through the diagnostics hook.
 */
const makeUnitializedClient = () => ({
  init: (initOptions: InitOptions = {}) =>
    Effect.gen(function* init() {
      const identityManager = yield* IdentityManager;
      const personInfoManager = yield* PersonInfoManager;
      const schemaManager = yield* SchemaManager;
      const atomRegistry = yield* AtomRegistry.AtomRegistry;

      if (initOptions.distinctId) {
        yield* Effect.logDebug("Initializing with provided distinct id", {
          distinctId: initOptions.distinctId,
        });

        // `identityManager.identify()` publishes the new person to
        // `currentPersonAtom`, so we don't duplicate that here.
        const [outcome, runtimeSchema] = yield* Effect.all(
          [
            Effect.result(identityManager.identify(initOptions.distinctId, {})),
            schemaManager.resolveSchema({
              distinctId: initOptions.distinctId,
              internalSchema: initOptions.internalSchema,
            }),
          ],
          { concurrency: "unbounded" },
        );
        if (Result.isFailure(outcome)) {
          const diagnostics = yield* Diagnostics;
          yield* diagnostics.emit({
            code: DIAGNOSTIC_CODES.REQUEST_FAILED,
            httpStatus: Option.getOrUndefined(httpStatusOf(outcome.failure)),
            kind: "transport",
            message: "The server refused the identify at init; the identity is pinned locally",
            operation: "identify",
            retryable: false,
          });
          yield* identityManager.pinLocalIdentity(initOptions.distinctId);
        } else if (outcome.success.status === "deferred") {
          const analyticsService = yield* AnalyticsService;
          yield* captureDeferredIdentify(
            analyticsService,
            outcome.success,
            initOptions.distinctId,
            {},
          );
        }
        return yield* makeInitializedClient({
          preloadPaywallAsset: initOptions.preloadPaywallAsset,
          preloadPlacements: initOptions.preloadPlacements ?? [],
          schema: runtimeSchema,
        });
      }

      const distinctId = yield* identityManager.getDistinctId();
      yield* Effect.logDebug("Initializing without provided distinct id", {
        distinctId,
      });

      // Both legs recover from transport failures internally, so a cold cache
      // on an unreachable network still boots.
      const [prefetchedPerson, runtimeSchema] = yield* Effect.all(
        [
          personInfoManager.resolvePerson(distinctId),
          schemaManager.resolveSchema({
            distinctId,
            internalSchema: initOptions.internalSchema,
          }),
        ],
        { concurrency: "unbounded" },
      );

      // Publish the prefetched person so React subscribers see initial
      // state without having to wait for a hook-driven refetch.
      // `SchemaManager` publishes `schemaAtom` itself.
      atomRegistry.set(currentPersonAtom, Option.fromNullOr(prefetchedPerson.person));

      return yield* makeInitializedClient({
        preloadPaywallAsset: initOptions.preloadPaywallAsset,
        preloadPlacements: initOptions.preloadPlacements ?? [],
        schema: runtimeSchema,
      });
    }),
});

/**
 * Fails a read exactly once with `AUTHENTICATION_FAILED` when the publishable
 * key was rejected and there is nothing cached to answer with. A read that can
 * still serve a cached value stays an `Ok` — the failure was already reported
 * through the diagnostics hook — but a read that answers with nothing because
 * of a bad key has to say so, or a misconfigured build looks like a user who
 * simply owns nothing.
 */
const surfaceAuthenticationFailure = (answeredWithNothing: boolean) =>
  Effect.gen(function* surfaceAuthenticationFailure() {
    if (!answeredWithNothing) return;
    const authGate = yield* AuthGate;
    if (!authGate.takeUnsurfaced()) return;
    return yield* Effect.fail(
      new AuthenticationFailedError(
        "The publishable key was rejected. Check the key this build ships with.",
      ),
    );
  });

/**
 * Publishes a person snapshot to the reactive store, unless the identity
 * changed since `epoch`: a read that started under the previous identity must
 * not overwrite the store `identify()`/`reset()` just replaced.
 */
const publishPerson = (
  atomRegistry: AtomRegistry.AtomRegistry,
  identityEpoch: typeof IdentityEpoch.Service,
  epoch: number,
  // oxlint-disable-next-line effect/prefer-option-over-null -- mirrors `PersonSnapshot.person`, which is `null` before any snapshot exists.
  person: SdkPerson | null,
) => {
  if (identityEpoch.current() !== epoch) return;
  atomRegistry.set(currentPersonAtom, Option.fromNullOr(person));
};

/**
 * Drains the analytics queue on its own fiber and waits for it at most
 * {@link IDENTIFY_FLUSH_BUDGET_MS}. Used before an identity switch so queued
 * events go out under the identity that captured them, without letting a slow
 * or unreachable server hold the switch hostage: every event is already
 * stamped with its distinct id, so a flush that outlives the budget still
 * attributes correctly when it lands.
 */
const flushWithinBudget = (analyticsService: typeof AnalyticsService.Service) =>
  Effect.gen(function* flushWithinBudget() {
    const flushFiber = yield* analyticsService.startFlush();
    yield* Effect.timeoutOption(Fiber.await(flushFiber), Duration.millis(IDENTIFY_FLUSH_BUDGET_MS));
  });

/**
 * Build the initialized SDK facade. Yields long-lived services from the
 * runtime (most notably `AnalyticsService`, so its mutable queue/timer can be
 * exposed via the synchronous accessors below) and returns an object that
 * delegates every method to the appropriate service.
 */
const makeInitializedClient = (options: {
  readonly preloadPaywallAsset?: (locationSlug: string, htmlUrl: string) => Promise<unknown>;
  readonly preloadPlacements?: ReadonlyArray<string>;
  readonly schema: RuntimeSchema;
}) =>
  Effect.gen(function* () {
    const analyticsService = yield* AnalyticsService;
    const sessionManager = yield* AnalyticsSessionManager;
    const identityEpoch = yield* IdentityEpoch;

    return {
      end: () =>
        Effect.gen(function* end() {
          const transactionService = yield* TransactionService;
          return yield* transactionService.endConnection();
        }),

      getFeatureFlags: (flagKeys?: string[]) =>
        Effect.gen(function* getFeatureFlags() {
          const featureFlagService = yield* FeatureFlagService;
          const result = yield* featureFlagService.getFeatureFlags(flagKeys);
          yield* surfaceAuthenticationFailure(
            (result.isStale ?? false) && Arr.isReadonlyArrayEmpty(result.flags),
          );
          return result;
        }),

      getPaywallForLocation: (locationSlug: LocationSlug) =>
        Effect.gen(function* getPaywallForLocation() {
          const paywallService = yield* PaywallService;
          return yield* paywallService.getPaywallForLocation(locationSlug);
        }),

      /**
       * Builds the deploy-contract §7.1 runtime config for a code-release
       * paywall: maps the release's product slugs through the native store
       * metadata, passes variables through unchanged and stamps the current
       * platform + locale. Slugs the store can't resolve are skipped (debug
       * log) — an empty products list is still a valid config.
       */
      buildPaywallRuntimeConfig: (runtime: PaywallReleaseRuntime) =>
        Effect.gen(function* buildRuntimeConfig() {
          const productService = yield* ProductService;
          const platformProvider = yield* PlatformProvider;

          const productsBySlug = yield* productService.getProducts(options.schema);

          const skippedSlugs: string[] = [];
          const runtimeConfig = buildPaywallRuntimeConfig({
            runtime,
            productsBySlug,
            platform: platformProvider.platform,
            locale: Option.fromNullishOr(platformProvider.locales[0]?.languageTag),
            onSkippedProductSlug: Option.some((slug) => skippedSlugs.push(slug)),
          });

          if (Arr.isReadonlyArrayNonEmpty(skippedSlugs)) {
            yield* Effect.logDebug("Skipping paywall products unresolved in the native store", {
              slugs: skippedSlugs,
            });
          }

          return runtimeConfig;
        }),

      /**
       * Cache-first person read. Returns the snapshot together with how much
       * to trust it; never fails because the server is unreachable.
       */
      getCurrentPerson: (forceFetch = false) =>
        Effect.gen(function* getCurrentPerson() {
          const identityManager = yield* IdentityManager;
          const personInfoManager = yield* PersonInfoManager;
          const atomRegistry = yield* AtomRegistry.AtomRegistry;
          const epoch = identityEpoch.current();
          const distinctId = yield* identityManager.getDistinctId();
          const snapshot = yield* personInfoManager.resolvePerson(distinctId, { forceFetch });
          // Publish to the reactive store so any subscribed React hook
          // re-renders with the latest result (whether cached or freshly
          // fetched).
          publishPerson(atomRegistry, identityEpoch, epoch, snapshot.person);
          yield* surfaceAuthenticationFailure(snapshot.person === null);
          return snapshot;
        }),

      /**
       * Answers an entitlement check from the cached person snapshot, starting
       * a refresh behind the read when the snapshot is stale.
       */
      hasPerk: (perkSlug: PerkSlug, hasPerkOptions: { readonly forceFetch?: boolean } = {}) =>
        Effect.gen(function* hasPerk() {
          const identityManager = yield* IdentityManager;
          const personInfoManager = yield* PersonInfoManager;
          const atomRegistry = yield* AtomRegistry.AtomRegistry;
          const epoch = identityEpoch.current();
          const distinctId = yield* identityManager.getDistinctId();
          const snapshot = yield* personInfoManager.resolvePerson(distinctId, {
            forceFetch: hasPerkOptions.forceFetch,
          });
          publishPerson(atomRegistry, identityEpoch, epoch, snapshot.person);
          yield* surfaceAuthenticationFailure(snapshot.person === null);
          const grant = findActiveGrant(Option.fromNullOr(snapshot.person), perkSlug);
          return {
            grant,
            hasAccess: Option.isSome(grant),
            isExpired: snapshot.isExpired,
            isStale: snapshot.isStale,
            reason: snapshot.reason,
          };
        }),

      /**
       * Sets person attributes asynchronously (primary, fire-and-forget).
       * Reserved `email`/`name` keys map to the dedicated server fields; any
       * other key is forwarded as a custom trait. Rides the existing analytics
       * queue as a `$set` capture — the queue's own batching/flushing delivers
       * it. `$process_person_profile: true` is required so anonymous users
       * still get a person created server-side. Returns void; does not flush.
       */
      setPersonAttributes: (attributes: PersonAttributes) =>
        Effect.gen(function* setPersonAttributes() {
          const { email, name, ...rest } = attributes;
          const properties = {
            $set: {
              ...rest,
              ...(email !== undefined ? { email } : {}),
              ...(name !== undefined ? { name } : {}),
            },
            $process_person_profile: true,
          };
          yield* analyticsService.capture("$set", properties);
        }),

      /**
       * Syncs attributes and reports whether the server confirmed them
       * (`confirmed`) or the update was queued for later delivery because the
       * server was unreachable (`deferred`). A deferred result still carries
       * the last known snapshot.
       */
      setPersonAttributesSync: (attributes: PersonAttributes) =>
        Effect.gen(function* setPersonAttributesSync() {
          const identityManager = yield* IdentityManager;
          const personAttributeManager = yield* PersonAttributeManager;
          const personInfoManager = yield* PersonInfoManager;
          const atomRegistry = yield* AtomRegistry.AtomRegistry;
          const distinctId = yield* identityManager.getDistinctId();
          const outcome = yield* Effect.result(
            personAttributeManager.syncPersonAttributes(distinctId, attributes),
          );

          if (Result.isSuccess(outcome)) {
            yield* personInfoManager.cache(distinctId, outcome.success);
            atomRegistry.set(currentPersonAtom, Option.some(outcome.success));
            return { person: outcome.success, status: "confirmed" as const };
          }

          const status = httpStatusOf(outcome.failure);
          if (Option.isSome(status) && !isRetryableStatus(status.value)) {
            return yield* Effect.fail(outcome.failure);
          }

          // The update rides the analytics queue instead, which retries until
          // it lands, and the caller keeps the last known snapshot.
          const { email, name, ...rest } = attributes;
          yield* analyticsService.capture("$set", {
            $process_person_profile: true,
            $set: {
              ...rest,
              ...(email !== undefined ? { email } : {}),
              ...(name !== undefined ? { name } : {}),
            },
          });
          const cached = yield* personInfoManager.getPerson(distinctId, "cache");
          return { person: cached, status: "deferred" as const };
        }),

      getCachedPerson: () =>
        Effect.gen(function* getCachedPerson() {
          const identityManager = yield* IdentityManager;
          const personInfoManager = yield* PersonInfoManager;
          const distinctId = yield* identityManager.getDistinctId();
          return yield* personInfoManager.getPerson(distinctId, "cache");
        }),

      resetPersonCache: () =>
        Effect.gen(function* resetPersonCache() {
          const identityManager = yield* IdentityManager;
          const personInfoManager = yield* PersonInfoManager;
          const distinctId = yield* identityManager.getDistinctId();
          return yield* personInfoManager.resetCache(distinctId);
        }),

      getDistinctId: () =>
        Effect.gen(function* getDistinctId() {
          const identityManager = yield* IdentityManager;
          return yield* identityManager.getDistinctId();
        }),

      getProducts: () =>
        Effect.gen(function* getProducts() {
          const productService = yield* ProductService;
          return yield* productService.getProducts(options.schema);
        }),

      /** Read access to the schema fetched at init time. */
      getSchema: () => options.schema,

      /**
       * Switches the identity and reports whether the server confirmed it
       * (`confirmed`) or the switch is local for now and queued as a
       * `$identify` event (`deferred`). Queued events are flushed first so
       * they attribute to the pre-switch distinct id, but the flush is only
       * waited on for {@link IDENTIFY_FLUSH_BUDGET_MS}: it keeps running past
       * that, and neither a slow nor a failed flush can fail the switch.
       */
      identify: (distinctId: string, identifyOptions: IdentifyOptions) =>
        Effect.gen(function* identify() {
          const identityManager = yield* IdentityManager;
          // Flushed here in the facade (not in `IdentityManager`) because
          // `AnalyticsService` depends on `IdentityManager` — a flush inside
          // the manager would create a layer cycle.
          yield* flushWithinBudget(analyticsService);
          const outcome = yield* identityManager.identify(distinctId, identifyOptions);
          if (outcome.status === "deferred") {
            yield* captureDeferredIdentify(analyticsService, outcome, distinctId, identifyOptions);
          }
          return outcome;
        }),

      iosPresentCodeRedemptionSheet: () =>
        Effect.gen(function* iosPresentCodeRedemptionSheet() {
          const paymentAdapter = yield* PaymentAdapter;
          if (!paymentAdapter.presentCodeRedemptionSheet) {
            return yield* Effect.fail(
              new UnsupportedPlatformError(
                "Present code redemption sheet is not supported on this platform",
              ),
            );
          }
          return yield* paymentAdapter.presentCodeRedemptionSheet();
        }),

      iosShowManageSubscriptions: () =>
        Effect.gen(function* iosShowManageSubscriptions() {
          const paymentAdapter = yield* PaymentAdapter;
          if (!paymentAdapter.showManageSubscriptions) {
            return yield* Effect.fail(
              new UnsupportedPlatformError(
                "Show manage subscriptions is not supported on this platform",
              ),
            );
          }
          return yield* paymentAdapter.showManageSubscriptions();
        }),

      processObservedTransaction: (transaction: Transaction) =>
        Effect.gen(function* processObservedTransaction() {
          const transactionService = yield* TransactionService;
          return yield* transactionService.processObservedTransaction(transaction, options.schema);
        }),

      /**
       * Buys a product. Resolves to whether the backend accepted the receipt;
       * `false` means it is in the outbox waiting for the server.
       */
      purchase: (product: Product) =>
        Effect.gen(function* purchase() {
          const transactionService = yield* TransactionService;
          return yield* transactionService.purchase(product, options.schema);
        }),

      restorePurchases: () =>
        Effect.gen(function* restorePurchases() {
          const transactionService = yield* TransactionService;
          yield* transactionService.restorePurchases(options.schema);
        }),

      reconcileObservedTransactions: () =>
        Effect.gen(function* reconcileObservedTransactions() {
          const transactionService = yield* TransactionService;
          return yield* transactionService.reconcileObservedTransactions(options.schema);
        }),

      // --- Analytics: Effect methods delegate to AnalyticsService ---

      getAnalyticsStandardizedProperties: () => analyticsService.getStandardizedProperties(),

      capture: (eventName: string, properties: Record<string, unknown> = {}) =>
        analyticsService.capture(eventName, properties),

      flush: () => analyticsService.flush(),

      /**
       * Returns the active analytics session id, starting a new session when
       * none is active. Counts as activity: the session's inactivity window
       * restarts from this call.
       */
      getSessionId: () => sessionManager.current(),

      transferAnalyticsEvents: (
        events: ReadonlyArray<{
          eventName: string;
          properties: Record<string, unknown>;
        }>,
      ) => analyticsService.transferEvents(events),

      captureAutomaticStartupEvents: () => analyticsService.captureAutomaticStartupEvents(),

      sendAnalyticsEvents: (events: ReadonlyArray<AnalyticsIngestEvent>) =>
        analyticsService.sendAnalyticsEvents(events),

      setupAutomaticLifecycleEvents: (captureEvent: (eventName: string) => void) =>
        Effect.gen(function* setupAutomaticLifecycleEvents() {
          const lifecycleService = yield* LifecycleService;
          return yield* lifecycleService.setupAutomaticLifecycleEvents(captureEvent);
        }),

      // --- Analytics: sync accessors read directly from the service ---

      getAnalyticsQueueLength: () => analyticsService.getQueueLength(),

      /**
       * Synchronous, non-touching read of the active session id; `undefined`
       * when no session has started or the last one timed out.
       */
      getCurrentSessionId: () => sessionManager.getCurrentIdUnsafe(),

      setAnalyticsFlushCallback: (callback: () => void) => {
        analyticsService.setFlushCallback(callback);
      },

      // --- Identity ---

      /**
       * Resets to a fresh anonymous identity. Queued events are flushed
       * first, within the same budget `identify` uses, so a reset while the
       * server is unreachable still completes promptly.
       */
      reset: () =>
        Effect.gen(function* reset() {
          const identityManager = yield* IdentityManager;
          // Flushed in the facade, not in `IdentityManager`, to avoid a layer
          // cycle (`AnalyticsService` depends on `IdentityManager`).
          yield* flushWithinBudget(analyticsService);
          return yield* identityManager.reset();
        }),

      /**
       * Captures the built-in `$sign_out` event, flushes within the identify
       * budget and resets to a fresh anonymous identity. The event is stamped
       * with the signing-out distinct id at capture, so it attributes
       * correctly even when the flush lands after the reset.
       */
      signOut: () =>
        Effect.gen(function* signOut() {
          const identityManager = yield* IdentityManager;
          yield* analyticsService.capture(AUTOMATIC_EVENTS.SIGN_OUT);
          yield* flushWithinBudget(analyticsService);
          const person = yield* identityManager.reset();
          // Rotated after `reset()`, which clears the cache: the next event
          // starts a fresh session and the new id is what ends up persisted.
          yield* sessionManager.rotate();
          return person;
        }),

      /**
       * Boot and foreground refresh chain: schema, then person, flags and the
       * paywalls for every known or preloaded placement. Every leg recovers
       * from transport failures on its own, so this never fails.
       */
      refreshAll: () =>
        Effect.gen(function* refreshAll() {
          const identityManager = yield* IdentityManager;
          const personInfoManager = yield* PersonInfoManager;
          const featureFlagService = yield* FeatureFlagService;
          const paywallService = yield* PaywallService;
          const schemaManager = yield* SchemaManager;
          const distinctId = yield* identityManager.getDistinctId();

          const diagnostics = yield* Diagnostics;
          const reportFailure = (operation: string) => (cause: Cause.Cause<unknown>) =>
            diagnostics.emit({
              code: DIAGNOSTIC_CODES.BACKGROUND_TASK_FAILED,
              kind: "transport",
              message: `Background refresh of ${operation} failed: ${Cause.pretty(cause)}`,
              operation,
              retryable: true,
            });

          yield* schemaManager.refresh(distinctId);
          yield* personInfoManager.refresh(distinctId);
          // oxlint-disable-next-line effect/effect-catchall-default -- deliberate blanket recovery: a background refresh must never fail the chain behind it, but it is reported rather than swallowed.
          yield* featureFlagService
            .getFeatureFlags()
            .pipe(Effect.catchCause(reportFailure("evaluateFeatureFlags")));
          const assets = yield* paywallService.preloadPlacements(options.preloadPlacements ?? []);
          const preloadPaywallAsset = options.preloadPaywallAsset;
          if (preloadPaywallAsset !== undefined) {
            yield* Effect.forEach(
              assets,
              ({ htmlUrl, locationSlug }) =>
                Effect.tryPromise({
                  try: () => preloadPaywallAsset(locationSlug, htmlUrl),
                  catch: (error) => error,
                }).pipe(Effect.catchCause(reportFailure("paywall.preload"))),
              { concurrency: 1 },
            );
          }
        }),

      /**
       * Clears an authentication pause. Called when the host reconfigures the
       * SDK, which is the moment a corrected publishable key arrives.
       */
      resumeAuthentication: () => Effect.flatMap(AuthGate, (authGate) => authGate.resume()),

      /** Half-opens every tripped host, so a foreground retries immediately. */
      halfOpenCircuits: () => Effect.flatMap(CircuitBreaker, (breaker) => breaker.halfOpenAll()),

      /** Re-attempts every receipt still waiting for the server. */
      syncTransactionOutbox: () =>
        Effect.flatMap(TransactionService, (transactionService) =>
          transactionService.syncOutbox(options.schema),
        ),

      /** Number of receipts still waiting for the server. */
      getPendingTransactionCount: () =>
        Effect.map(
          Effect.flatMap(TransactionOutbox, (outbox) => outbox.pending()),
          (entries) => entries.length,
        ),

      /**
       * Subscribes to host-provided reachability changes, when there is one.
       * `onOnline` fires only on an offline-to-online transition: a source
       * that repeats `true` (or reports it first thing) does not trigger a
       * recovery, so a chatty reachability library cannot turn into a
       * request storm.
       */
      observeConnectivity: (onOnline: () => void) =>
        Effect.flatMap(Connectivity, (connectivity) => {
          const lastOnline = MutableRef.make(Option.none<boolean>());
          return connectivity.subscribe((online) => {
            const previous = MutableRef.get(lastOnline);
            MutableRef.set(lastOnline, Option.some(online));
            if (online && Option.contains(previous, false)) onOnline();
          });
        }),

      startTransactionObserver: (onPurchase?: (transaction: Transaction) => void) =>
        Effect.gen(function* startTransactionObserver() {
          const transactionService = yield* TransactionService;
          return yield* transactionService.startTransactionObserver(onPurchase);
        }),
    } as const;
  });

export const VoidhashEffectClient = {
  makeInitializedClient,
  makeUnitializedClient,
} as const;
