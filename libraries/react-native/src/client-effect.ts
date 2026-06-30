import { Effect } from "effect";
import { AtomRegistry } from "effect/unstable/reactivity";

import { AUTOMATIC_EVENTS } from "./core/analytics/constants";
import { AnalyticsService } from "./core/analytics/service";
import type { AnalyticsIngestEvent } from "./core/analytics/types";
import type { SubscriptionProduct } from "./core/entities/product";
import type { Transaction } from "./core/entities/transaction";
import { FeatureFlagService } from "./core/feature-flags/feature-flag-service";
import {
  type PersonAttributes,
  PersonAttributeManager,
} from "./core/identity/person-attribute-manager";
import { PersonInfoManager } from "./core/identity/person-info-manager";
import { IdentityManager } from "./core/identity/identity-manager";
import { LifecycleService } from "./core/lifecycle/lifecycle-service";
import { PaymentAdapter } from "./core/payment-adapters/payment-adapter";
import { buildPaywallRuntimeConfig } from "./core/paywalls/paywall-runtime-config";
import {
  type PaywallReleaseRuntime,
  PaywallService,
} from "./core/paywalls/paywall-service";
import { PlatformProvider } from "./core/platform/platform-provider";
import {
  ProductService,
  type ProductsBySlug,
} from "./core/products/product-service";
import { currentPersonAtom } from "./core/reactivity/client-state";
import type { LocationSlug } from "./core/schema/registry";
import type { RuntimeSchema } from "./core/schema/runtime";
import { SchemaManager } from "./core/schema/schema-manager";
import { TransactionService } from "./core/transactions/transaction-service";
import { UnsupportedPlatformError } from "./errors";

export type { ProductsBySlug };
export type { AnalyticsIngestEvent };
export type { PersonAttributes };

interface InitOptions {
  readonly distinctId?: string;
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
 * A missing/failed schema fetch is fatal — when the cache is cold and the
 * server is unreachable, `init` rejects with `FailedToFetchSchemaError`.
 * This trades silent degradation for a loud failure that surfaces through
 * `client.tsx`'s `runEffect` wrapping.
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
        const [, runtimeSchema] = yield* Effect.all(
          [
            identityManager.identify(initOptions.distinctId, {}),
            schemaManager.resolveSchema({
              distinctId: initOptions.distinctId,
              internalSchema: initOptions.internalSchema,
            }),
          ],
          { concurrency: "unbounded" },
        );
        return yield* makeInitializedClient({ schema: runtimeSchema });
      }

      const distinctId = yield* identityManager.getDistinctId();
      yield* Effect.logDebug("Initializing without provided distinct id", {
        distinctId,
      });

      const [prefetchedPerson, runtimeSchema] = yield* Effect.all(
        [
          personInfoManager.getPerson(distinctId, "fetch"),
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
      atomRegistry.set(currentPersonAtom, prefetchedPerson);

      return yield* makeInitializedClient({ schema: runtimeSchema });
    }),
});

/**
 * Build the initialized SDK facade. Yields long-lived services from the
 * runtime (most notably `AnalyticsService`, so its mutable queue/timer can be
 * exposed via the synchronous accessors below) and returns an object that
 * delegates every method to the appropriate service.
 */
const makeInitializedClient = (options: { schema: RuntimeSchema }) =>
  Effect.gen(function* () {
    const analyticsService = yield* AnalyticsService;

    return {
      end: () =>
        Effect.gen(function* end() {
          const transactionService = yield* TransactionService;
          return yield* transactionService.endConnection();
        }),

      getFeatureFlags: (flagKeys?: string[]) =>
        Effect.gen(function* getFeatureFlags() {
          const featureFlagService = yield* FeatureFlagService;
          return yield* featureFlagService.getFeatureFlags(flagKeys);
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

          const productsBySlug = yield* productService.getProducts(
            options.schema,
          );

          const skippedSlugs: string[] = [];
          const runtimeConfig = buildPaywallRuntimeConfig({
            runtime,
            productsBySlug,
            platform: platformProvider.platform,
            locale: platformProvider.locales[0]?.languageTag,
            onSkippedProductSlug: (slug) => skippedSlugs.push(slug),
          });

          if (skippedSlugs.length > 0) {
            yield* Effect.logDebug(
              "Skipping paywall products unresolved in the native store",
              { slugs: skippedSlugs },
            );
          }

          return runtimeConfig;
        }),

      getCurrentPerson: (forceFetch = false) =>
        Effect.gen(function* getCurrentPerson() {
          const identityManager = yield* IdentityManager;
          const personInfoManager = yield* PersonInfoManager;
          const atomRegistry = yield* AtomRegistry.AtomRegistry;
          const distinctId = yield* identityManager.getDistinctId();
          const person = yield* personInfoManager.getPerson(
            distinctId,
            forceFetch ? "fetch" : "fetch-while-stale",
          );
          // Publish to the reactive store so any subscribed React hook
          // re-renders with the latest result (whether cached or freshly
          // fetched).
          atomRegistry.set(currentPersonAtom, person);
          return person;
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
       * Sets person attributes synchronously (opt-in). Performs the network
       * sync, caches and publishes the returned person snapshot to
       * `currentPersonAtom`, and returns it. Use when the caller needs the
       * updated snapshot immediately; otherwise prefer `setPersonAttributes`.
       */
      setPersonAttributesSync: (attributes: PersonAttributes) =>
        Effect.gen(function* setPersonAttributesSync() {
          const identityManager = yield* IdentityManager;
          const personAttributeManager = yield* PersonAttributeManager;
          const personInfoManager = yield* PersonInfoManager;
          const atomRegistry = yield* AtomRegistry.AtomRegistry;
          const distinctId = yield* identityManager.getDistinctId();
          const person = yield* personAttributeManager.syncPersonAttributes(
            distinctId,
            attributes,
          );
          yield* personInfoManager.cache(distinctId, person);
          atomRegistry.set(currentPersonAtom, person);
          return person;
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

      identify: (
        distinctId: string,
        identifyOptions: {
          email?: string;
          name?: string;
        },
      ) =>
        Effect.gen(function* identify() {
          const identityManager = yield* IdentityManager;
          // Drain queued events first so they attribute to the pre-switch
          // distinct id. Flushed here in the facade (not in `IdentityManager`)
          // because `AnalyticsService` depends on `IdentityManager` — a flush
          // inside the manager would create a layer cycle.
          yield* analyticsService.flush();
          return yield* identityManager.identify(distinctId, identifyOptions);
        }),

      iosPresentCodeRedemptionSheet: () =>
        Effect.gen(function* iosPresentCodeRedemptionSheet() {
          const paymentAdapter = yield* PaymentAdapter;
          const { presentCodeRedemptionSheet } = paymentAdapter;
          if (!presentCodeRedemptionSheet) {
            return yield* Effect.fail(
              new UnsupportedPlatformError(
                "Present code redemption sheet is not supported on this platform",
              ),
            );
          }
          return yield* presentCodeRedemptionSheet();
        }),

      iosShowManageSubscriptions: () =>
        Effect.gen(function* iosShowManageSubscriptions() {
          const paymentAdapter = yield* PaymentAdapter;
          const { showManageSubscriptions } = paymentAdapter;
          if (!showManageSubscriptions) {
            return yield* Effect.fail(
              new UnsupportedPlatformError(
                "Show manage subscriptions is not supported on this platform",
              ),
            );
          }
          return yield* showManageSubscriptions();
        }),

      processObservedTransaction: (transaction: Transaction) =>
        Effect.gen(function* processObservedTransaction() {
          const transactionService = yield* TransactionService;
          return yield* transactionService.processObservedTransaction(
            transaction,
            options.schema,
          );
        }),

      purchase: (
        product: SubscriptionProduct,
        _options: {
          method?: "native";
        },
      ) =>
        Effect.gen(function* purchase() {
          const transactionService = yield* TransactionService;
          yield* transactionService.purchase(product, options.schema);
        }),

      restorePurchases: () =>
        Effect.gen(function* restorePurchases() {
          const transactionService = yield* TransactionService;
          yield* transactionService.restorePurchases(options.schema);
        }),

      reconcileObservedTransactions: () =>
        Effect.gen(function* reconcileObservedTransactions() {
          const transactionService = yield* TransactionService;
          return yield* transactionService.reconcileObservedTransactions(
            options.schema,
          );
        }),

      // --- Analytics: Effect methods delegate to AnalyticsService ---

      getAnalyticsStandardizedProperties: () =>
        analyticsService.getStandardizedProperties(),

      capture: (eventName: string, properties: Record<string, unknown> = {}) =>
        analyticsService.capture(eventName, properties),

      flush: () => analyticsService.flush(),

      transferAnalyticsEvents: (
        events: ReadonlyArray<{
          eventName: string;
          properties: Record<string, unknown>;
        }>,
      ) => analyticsService.transferEvents(events),

      captureAutomaticStartupEvents: () =>
        analyticsService.captureAutomaticStartupEvents(),

      sendAnalyticsEvents: (events: ReadonlyArray<AnalyticsIngestEvent>) =>
        analyticsService.sendAnalyticsEvents(events),

      setupAutomaticLifecycleEvents: (
        captureEvent: (eventName: string) => void,
      ) =>
        Effect.gen(function* setupAutomaticLifecycleEvents() {
          const lifecycleService = yield* LifecycleService;
          return yield* lifecycleService.setupAutomaticLifecycleEvents(
            captureEvent,
          );
        }),

      // --- Analytics: sync accessors read directly from the service ---

      getAnalyticsQueueLength: () => analyticsService.getQueueLength(),

      setAnalyticsFlushCallback: (callback: () => void) => {
        analyticsService.setFlushCallback(callback);
      },

      // --- Identity ---

      reset: () =>
        Effect.gen(function* reset() {
          const identityManager = yield* IdentityManager;
          // Drain queued events first so they attribute to the pre-reset
          // distinct id (after reset, `getDistinctId()` mints a fresh anon id).
          // Flushed in the facade, not in `IdentityManager`, to avoid a layer
          // cycle (`AnalyticsService` depends on `IdentityManager`).
          yield* analyticsService.flush();
          return yield* identityManager.reset();
        }),

      signOut: () =>
        Effect.gen(function* signOut() {
          const identityManager = yield* IdentityManager;
          // Capture the built-in sign-out event and drain the queue *before*
          // resetting: `reset()` clears the identity cache, after which
          // `getDistinctId()` mints a fresh anonymous id. Flushing first keeps
          // `$sign_out` (and any pending events) attributed to the
          // signing-out distinct id rather than the post-reset anonymous one.
          yield* analyticsService.capture(AUTOMATIC_EVENTS.SIGN_OUT);
          yield* analyticsService.flush();
          return yield* identityManager.reset();
        }),

      startTransactionObserver: (
        onPurchase?: (transaction: Transaction) => void,
      ) =>
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
