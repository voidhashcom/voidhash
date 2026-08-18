/**
 * Integration tests for {@link PaymentProviderProductService}, run against the
 * real backend stack provisioned once by `test/_testing/globalSetup.ts` (live
 * PostgreSQL; only the project schema cache is an
 * in-memory stub).
 *
 * The service maps catalog `product` rows to provider-specific product keys via
 * the `paymentProviderConfigurationProducts` join table. Each test drives a
 * public method end-to-end and verifies the *persisted* side effects rather
 * than just the return value:
 *  - the join row inserted / updated / deactivated / hard-deleted in MySQL,
 *  - the matching `audit_log` row (entity, action, actor, change snapshot),
 *  - invalidation of the project's schema cache after a successful write,
 *  - the App Store parked-notification replay workflow being dispatched only
 *    when the owning configuration's provider is `apple-app-store`.
 *
 * Conventions used throughout:
 *  - The fixture only seeds user/org/member/project, so every test creates its
 *    own parent `product` + `paymentProviderConfiguration` rows under
 *    {@link CoreTestFixture.projectId} and cleans them up on exit via
 *    {@link withCleanup} (deepest dependents first, plus append-only audit rows
 *    by entity id). The global teardown sweep is only a backstop.
 *  - Provider keys are unique per call so a leftover row from a crashed run
 *    can't collide on the `(configurationId, providerProductKey, productId)`
 *    unique index, and assertions stay membership-based, never exact counts.
 *  - The three `PaymentProvider` adapter tags and the
 *    `AppStoreReplayParkedNotificationsWorkflow` port are NOT real infra here —
 *    they are deterministic in-process stubs ({@link makeServiceLayer}). The
 *    Stripe stub echoes the configuration and derives a product key; the App
 *    Store stub records every replay `dispatch` so the fire-and-forget branch
 *    is observable.
 *  - Permission tests re-authenticate just the call under test via
 *    {@link asUnauthorized}; the inner provision shadows the harness's default
 *    full-permission session.
 *  - Typed failures are asserted with `Effect.flip`, narrowing the swapped
 *    error with `instanceof` before reading its fields, always paired with a
 *    DB-state assertion on the failure path.
 */
import { DateTime, Effect, Layer, Schema } from "effect";
import { describe, expect } from "vitest";

import { PaymentProviderProductService, ProjectSchemaCache } from "@voidhash/core/services";
import {
  AppStorePaymentProvider,
  GooglePlayPaymentProvider,
  type PaymentProviderShape,
  StripePaymentProvider,
} from "@voidhash/core/services/paymentProviders/PaymentProvider";
import {
  AppStoreReplayParkedNotifications,
  type AppStoreReplayParkedNotificationsInput,
} from "@voidhash/core/workflows/definitions";
import { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import * as TestWorkflowRunner from "@voidhash/platform/TestWorkflowRunner";
import { WorkflowRunner } from "@voidhash/platform/WorkflowRunner";
import { ActionForbiddenError, type UserSession } from "@voidhash/core/domain/auth/Auth";
import {
  PaymentProviderProductNotFoundError,
  PaymentProviderProductValidationError,
} from "@voidhash/core/domain/paymentProvider/PaymentProviderProduct";
import { constant, stringOr } from "@voidhash/lib/lang";
import { generateId } from "@voidhash/core/utils/generate-id";
import {
  AuditLogAction,
  AuditLogActorType,
  AuditLogEntityType,
  Db,
  and,
  auditLogs,
  eq,
  inArray,
  paymentProviderConfigurationProducts,
  paymentProviderConfigurations,
  products,
} from "@voidhash/db";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;

/** Cuid2-backed suffix so keys stay unique even within the same millisecond. */
const uniqueKey = (label: string) => `it-ppprod-${label}-${generateId("test")}`;

/** Decodes a dispatched workflow payload into the replay input shape. */
const decodeReplayInput = Schema.decodeUnknownSync(
  Schema.Struct(AppStoreReplayParkedNotifications.payload),
);

/** Epoch timestamp used by the synthetic session fixture. */
const EPOCH = DateTime.toDateUtc(DateTime.makeUnsafe(0));

/**
 * Validation error config marker. When a configuration blob carries
 * `{ fail: true }` the stub Stripe provider fails with a
 * {@link PaymentProviderProductValidationError}, letting tests exercise the
 * provider-validation failure branch without any real SDK.
 */
const FAIL_MARKER = constant("fail");

/**
 * Records of every replay-workflow `dispatch` the service fires, captured so
 * tests can assert the App Store branch ran (or did not). A fresh array is
 * threaded into {@link makeServiceLayer} per test, so dispatches never leak
 * between tests.
 */
type DispatchLog = AppStoreReplayParkedNotificationsInput[];

/** Deterministic Stripe provider stub: echoes config, derives the product key. */
const stripeStub: PaymentProviderShape<"stripe"> = {
  createGlobalKey: (configuration) => Effect.succeed(stringOr(configuration.key, "stripe-global")),
  createProductKey: (configuration) =>
    Effect.succeed(stringOr(configuration.productKey, "stripe-product")),
  defaultGlobalConfiguration: () => Effect.succeed({}),
  defaultProductConfiguration: () => Effect.succeed({}),
  id: "stripe",
  title: "Stripe",
  type: "web-checkout",
  validateGlobalConfiguration: (configuration) =>
    Effect.succeed({ parsedConfiguration: configuration, paymentProviderKey: "stripe-global" }),
  validateProductConfiguration: (configuration) => {
    if (configuration[FAIL_MARKER] === true) {
      return Effect.fail(
        new PaymentProviderProductValidationError({
          message: "stub: invalid product configuration",
        }),
      );
    }
    return Effect.succeed({
      parsedConfiguration: { ...configuration, validated: true },
      productKey: stringOr(configuration.productKey, "stripe-product"),
    });
  },
};

/**
 * Build the full set of layers the service-under-test needs beyond the harness:
 * its own layer plus deterministic provider/workflow stubs. The App Store stub
 * shares the Stripe validation behaviour but carries the `apple-app-store` id
 * so the replay branch is exercised; its workflow port records every dispatch
 * into the supplied {@link DispatchLog}.
 */
const makeServiceLayer = (dispatches: DispatchLog) => {
  const appStoreStub: PaymentProviderShape<"apple-app-store"> = {
    ...stripeStub,
    id: "apple-app-store",
    title: "App Store",
    type: "native",
  };
  const googlePlayStub: PaymentProviderShape<"google-play"> = {
    ...stripeStub,
    id: "google-play",
    title: "Google Play",
    type: "native",
  };
  const runner = TestWorkflowRunner.make();

  const StubbedProviders = Layer.mergeAll(
    Layer.succeed(StripePaymentProvider, stripeStub),
    Layer.succeed(AppStorePaymentProvider, appStoreStub),
    Layer.succeed(GooglePlayPaymentProvider, googlePlayStub),
    Layer.succeed(WorkflowRunner, {
      ...runner,
      dispatch: (workflow, input) =>
        Effect.sync(() => {
          if (workflow.name === AppStoreReplayParkedNotifications.name) {
            dispatches.push(decodeReplayInput(input));
          }
        }).pipe(Effect.andThen(runner.dispatch(workflow, input))),
    }),
    Layer.succeed(PlatformRuntime, PlatformRuntime.of({})),
  );

  return PaymentProviderProductService.layer.pipe(Layer.provideMerge(StubbedProviders));
};

// ---------------------------------------------------------------------------
// Raw DB read-back helpers (bypass the service).
// ---------------------------------------------------------------------------

/** Read a provider-product join row straight from the database. */
const findProviderProductRow = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.paymentProviderConfigurationProducts.findFirst({
      where: { id },
    });
  });

/** All provider-product join rows for a given product (ordered for stability). */
const findProviderProductRowsForProduct = (productId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.paymentProviderConfigurationProducts.findMany({
      where: { productId },
    });
  });

/** All audit-log rows recorded for a given provider-product entity. */
const findAuditEntries = (entityId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.entityType, AuditLogEntityType.PaymentProviderProduct),
          eq(auditLogs.entityId, entityId),
        ),
      );
  });

// ---------------------------------------------------------------------------
// Parent-row fixtures (the seeded fixture only covers user/org/member/project).
// ---------------------------------------------------------------------------

/** Insert a product under the fixture project; returns its id. */
const insertProduct = (track: (kind: "product", id: string) => void) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const id = generateId("product");
    const slug = uniqueKey("product");
    yield* db.insert(products).values({ id, name: "IT Product", projectId, slug });
    track("product", id);
    return id;
  });

/** Insert a payment-provider configuration under the fixture project; returns its id. */
const insertConfiguration = (
  track: (kind: "configuration", id: string) => void,
  providerId: "stripe" | "apple-app-store" | "google-play" | "development" = "stripe",
) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const id = generateId("paymentProviderConfiguration");
    yield* db.insert(paymentProviderConfigurations).values({
      enabled: true,
      id,
      name: "IT Config",
      paymentProviderKey: uniqueKey("cfgkey"),
      projectId,
      providerId,
    });
    track("configuration", id);
    return id;
  });

const insertRawProviderProduct = (
  track: (kind: "providerProduct", id: string) => void,
  input: { readonly configurationId: string; readonly productId: string },
) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const id = generateId("paymentProviderProduct");
    yield* db.insert(paymentProviderConfigurationProducts).values({
      configuration: {},
      id,
      isActive: true,
      paymentProviderConfigurationId: input.configurationId,
      productId: input.productId,
      providerProductKey: uniqueKey("raw-provider-key"),
    });
    track("providerProduct", id);
    return id;
  });

// ---------------------------------------------------------------------------
// Cleanup: delete created join rows, products, configurations and their
// append-only audit rows on exit, regardless of how the test ends.
// ---------------------------------------------------------------------------

interface Tracked {
  readonly providerProducts: string[];
  readonly products: string[];
  readonly configurations: string[];
}

const cleanup = (tracked: Tracked) =>
  Effect.gen(function* () {
    const db = yield* Db;
    // `setActivePaymentProviderProduct` records its audit row under the
    // `PaymentProviderProduct` entity type keyed by the *product* id (not the
    // join-row id), so the audit sweep must target both id sets.
    const auditTargets = [...tracked.providerProducts, ...tracked.products];
    if (auditTargets.length > 0) {
      yield* db
        .delete(auditLogs)
        .where(
          and(
            eq(auditLogs.entityType, AuditLogEntityType.PaymentProviderProduct),
            inArray(auditLogs.entityId, auditTargets),
          ),
        )
        .pipe(Effect.ignore);
    }
    if (tracked.providerProducts.length > 0) {
      yield* db
        .delete(paymentProviderConfigurationProducts)
        .where(inArray(paymentProviderConfigurationProducts.id, [...tracked.providerProducts]))
        .pipe(Effect.ignore);
    }
    if (tracked.products.length > 0) {
      yield* db
        .delete(paymentProviderConfigurationProducts)
        .where(inArray(paymentProviderConfigurationProducts.productId, [...tracked.products]))
        .pipe(Effect.ignore);
      yield* db
        .delete(products)
        .where(inArray(products.id, [...tracked.products]))
        .pipe(Effect.ignore);
    }
    if (tracked.configurations.length > 0) {
      yield* db
        .delete(paymentProviderConfigurations)
        .where(inArray(paymentProviderConfigurations.id, [...tracked.configurations]))
        .pipe(Effect.ignore);
    }
  });

/**
 * Wrap a test body so every row it creates (provider products, products,
 * configurations, and their append-only audit rows) is removed afterward,
 * regardless of how the test exits. The body receives a `track` callback for
 * each created entity plus the {@link DispatchLog} the workflow stub appends to.
 * Cleanup reads the collected ids lazily at finalization via `Effect.ensuring`.
 *
 * The service layer is built *here* so the {@link DispatchLog} the body asserts
 * on is the exact same array the workflow stub records into — wiring the layer
 * with a separate `[]` outside this wrapper would leave every dispatch
 * assertion reading an array the service never touches.
 */
const withCleanup = <E, R>(
  body: (
    track: (kind: "providerProduct" | "product" | "configuration", id: string) => void,
    dispatches: DispatchLog,
  ) => Effect.Effect<void, E, R>,
) => {
  const tracked: Tracked = { configurations: [], products: [], providerProducts: [] };
  const dispatches: DispatchLog = [];
  const track = (kind: "providerProduct" | "product" | "configuration", id: string) => {
    if (kind === "providerProduct") tracked.providerProducts.push(id);
    else if (kind === "product") tracked.products.push(id);
    else tracked.configurations.push(id);
  };
  return body(track, dispatches).pipe(
    Effect.ensuring(cleanup(tracked)),
    Effect.provide(makeServiceLayer(dispatches)),
  );
};

// ---------------------------------------------------------------------------
// Auth helpers.
// ---------------------------------------------------------------------------

/** A `user`-method session for the fixture principal carrying no project access. */
const sessionWithoutProjectAccess = (): UserSession => ({
  cookie: null,
  method: "user",
  name: `${CoreTestFixture.userName} <${CoreTestFixture.userEmail}>`,
  organizations: [],
  person: null,
  projects: [],
  user: {
    createdAt: EPOCH,
    email: CoreTestFixture.userEmail,
    emailVerified: true,
    id: CoreTestFixture.userId,
    image: null,
    name: CoreTestFixture.userName,
    role: null,
    updatedAt: EPOCH,
    workosUserId: CoreTestFixture.workosUserId,
  },
});

/** Run a single call as a caller with no project access. */
const asUnauthorized = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(CoreAuthSession.authenticate(sessionWithoutProjectAccess()));

describe("PaymentProviderProductService.createPaymentProviderProduct", () => {
  test(
    "validates via the provider, inserts the row as active, records a Created audit entry, and invalidates the schema cache",
    withCleanup((track, dispatches) =>
      Effect.gen(function* () {
        const service = yield* PaymentProviderProductService;
        const cache = yield* ProjectSchemaCache;

        const productId = yield* insertProduct(track);
        const configId = yield* insertConfiguration(track);
        const productKey = uniqueKey("create");

        yield* cache.getByName(projectId).set({ marker: "present" }, 60_000);

        const created = yield* service.createPaymentProviderProduct({
          configuration: { productKey },
          paymentProviderConfigurationId: configId,
          productId,
        });
        track("providerProduct", created.id);
        expect(created.id.startsWith("pp_prod_")).toBe(true);

        const row = yield* findProviderProductRow(created.id);
        expect(row).toBeDefined();
        expect(row?.productId).toBe(productId);
        expect(row?.paymentProviderConfigurationId).toBe(configId);
        expect(row?.providerProductKey).toBe(productKey);
        expect(row?.isActive).toBe(true);
        // The stub's `validateProductConfiguration` stamps `validated: true`.
        expect(row?.configuration).toMatchObject({ productKey, validated: true });

        const audit = yield* findAuditEntries(created.id);
        const createdEntry = audit.find((entry) => entry.action === AuditLogAction.Created);
        expect(createdEntry).toBeDefined();
        expect(createdEntry?.entityType).toBe(AuditLogEntityType.PaymentProviderProduct);
        expect(createdEntry?.parentEntityId).toBe(productId);
        expect(createdEntry?.actorUserId).toBe(CoreTestFixture.userId);
        expect(createdEntry?.actorType).toBe(AuditLogActorType.User);

        const cached = yield* cache.getByName(projectId).get();
        expect(cached).toBeNull();

        // Stripe provider → no App Store replay dispatch.
        expect(dispatches.length).toBe(0);
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );

  test(
    "deactivates sibling rows for the same (product, configuration) and schedules the App Store replay when the provider is apple-app-store",
    withCleanup((track, dispatches) =>
      Effect.gen(function* () {
        const service = yield* PaymentProviderProductService;

        const productId = yield* insertProduct(track);
        const configId = yield* insertConfiguration(track, "apple-app-store");
        const firstKey = uniqueKey("apple-first");
        const secondKey = uniqueKey("apple-second");

        const first = yield* service.createPaymentProviderProduct({
          configuration: { productKey: firstKey },
          paymentProviderConfigurationId: configId,
          productId,
        });
        track("providerProduct", first.id);

        const second = yield* service.createPaymentProviderProduct({
          configuration: { productKey: secondKey },
          paymentProviderConfigurationId: configId,
          productId,
        });
        track("providerProduct", second.id);

        // The first row was deactivated; the newest insert is the active one.
        const firstRow = yield* findProviderProductRow(first.id);
        const secondRow = yield* findProviderProductRow(second.id);
        expect(firstRow?.isActive).toBe(false);
        expect(secondRow?.isActive).toBe(true);

        // App Store provider → one replay dispatch per create, carrying the new key.
        expect(dispatches.length).toBe(2);
        expect(
          dispatches.some(
            (d) => d.paymentProviderProductId === second.id && d.providerProductKey === secondKey,
          ),
        ).toBe(true);
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );

  test(
    "fails with PaymentProviderProductValidationError when the product does not exist and writes nothing",
    withCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* PaymentProviderProductService;
        const configId = yield* insertConfiguration(track);

        const error = yield* Effect.flip(
          service.createPaymentProviderProduct({
            configuration: { productKey: uniqueKey("missing-product") },
            paymentProviderConfigurationId: configId,
            productId: generateId("product"),
          }),
        );
        expect(error).toBeInstanceOf(PaymentProviderProductValidationError);
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );

  test(
    "fails with PaymentProviderProductValidationError when the configuration does not exist and writes nothing",
    withCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* PaymentProviderProductService;
        const productId = yield* insertProduct(track);

        const error = yield* Effect.flip(
          service.createPaymentProviderProduct({
            configuration: { productKey: uniqueKey("missing-config") },
            paymentProviderConfigurationId: generateId("paymentProviderConfiguration"),
            productId,
          }),
        );
        expect(error).toBeInstanceOf(PaymentProviderProductValidationError);

        const rows = yield* findProviderProductRowsForProduct(productId);
        expect(rows.length).toBe(0);
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );

  test(
    "propagates the provider's PaymentProviderProductValidationError and writes nothing",
    withCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* PaymentProviderProductService;
        const productId = yield* insertProduct(track);
        const configId = yield* insertConfiguration(track);

        const error = yield* Effect.flip(
          service.createPaymentProviderProduct({
            // The stub provider fails validation on this marker.
            configuration: { [FAIL_MARKER]: true, productKey: uniqueKey("provider-invalid") },
            paymentProviderConfigurationId: configId,
            productId,
          }),
        );
        expect(error).toBeInstanceOf(PaymentProviderProductValidationError);

        const rows = yield* findProviderProductRowsForProduct(productId);
        expect(rows.length).toBe(0);
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all on the product and writes nothing",
    withCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* PaymentProviderProductService;
        const productId = yield* insertProduct(track);
        const configId = yield* insertConfiguration(track);

        const error = yield* Effect.flip(
          asUnauthorized(
            service.createPaymentProviderProduct({
              configuration: { productKey: uniqueKey("forbidden") },
              paymentProviderConfigurationId: configId,
              productId,
            }),
          ),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);

        const rows = yield* findProviderProductRowsForProduct(productId);
        expect(rows.length).toBe(0);
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );
});

describe("PaymentProviderProductService.setActivePaymentProviderProduct", () => {
  test(
    "activates the matching key, deactivates the sibling, records an Updated audit entry, and invalidates the schema cache",
    withCleanup((track, dispatches) =>
      Effect.gen(function* () {
        const service = yield* PaymentProviderProductService;
        const cache = yield* ProjectSchemaCache;

        const productId = yield* insertProduct(track);
        const configId = yield* insertConfiguration(track);
        const keepKey = uniqueKey("activate-keep");
        const otherKey = uniqueKey("activate-other");

        const keep = yield* service.createPaymentProviderProduct({
          configuration: { productKey: keepKey },
          paymentProviderConfigurationId: configId,
          productId,
        });
        track("providerProduct", keep.id);
        const other = yield* service.createPaymentProviderProduct({
          configuration: { productKey: otherKey },
          paymentProviderConfigurationId: configId,
          productId,
        });
        track("providerProduct", other.id);

        // After the second create, `other` is active and `keep` deactivated.
        yield* cache.getByName(projectId).set({ marker: "present" }, 60_000);

        yield* service.setActivePaymentProviderProduct({
          paymentProviderConfigurationId: configId,
          productId,
          providerProductKey: keepKey,
        });

        const keepRow = yield* findProviderProductRow(keep.id);
        const otherRow = yield* findProviderProductRow(other.id);
        expect(keepRow?.isActive).toBe(true);
        expect(otherRow?.isActive).toBe(false);

        // Audit is recorded against the productId (entityId) for set-active.
        const audit = yield* findAuditEntries(productId);
        const updatedEntry = audit.find((entry) => entry.action === AuditLogAction.Updated);
        expect(updatedEntry).toBeDefined();
        expect(updatedEntry?.changes).toMatchObject({ providerProductKey: keepKey });

        const cached = yield* cache.getByName(projectId).get();
        expect(cached).toBeNull();

        // Stripe provider → no replay dispatch from set-active.
        expect(dispatches.length).toBe(0);
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );

  test(
    "schedules the App Store replay when the configuration's provider is apple-app-store",
    withCleanup((track, dispatches) =>
      Effect.gen(function* () {
        const service = yield* PaymentProviderProductService;
        const productId = yield* insertProduct(track);
        const configId = yield* insertConfiguration(track, "apple-app-store");
        const key = uniqueKey("apple-activate");

        const created = yield* service.createPaymentProviderProduct({
          configuration: { productKey: key },
          paymentProviderConfigurationId: configId,
          productId,
        });
        track("providerProduct", created.id);

        const dispatchesBefore = dispatches.length;
        yield* service.setActivePaymentProviderProduct({
          paymentProviderConfigurationId: configId,
          productId,
          providerProductKey: key,
        });

        expect(dispatches.length).toBe(dispatchesBefore + 1);
        expect(
          dispatches.some(
            (d) => d.paymentProviderProductId === productId && d.providerProductKey === key,
          ),
        ).toBe(true);
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );

  test(
    "fails with PaymentProviderProductValidationError when the product does not exist",
    withCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* PaymentProviderProductService;
        const configId = yield* insertConfiguration(track);

        const error = yield* Effect.flip(
          service.setActivePaymentProviderProduct({
            paymentProviderConfigurationId: configId,
            productId: generateId("product"),
            providerProductKey: uniqueKey("set-missing-product"),
          }),
        );
        expect(error).toBeInstanceOf(PaymentProviderProductValidationError);
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );

  test(
    "fails with PaymentProviderProductValidationError when the configuration does not exist",
    withCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* PaymentProviderProductService;
        const productId = yield* insertProduct(track);

        const error = yield* Effect.flip(
          service.setActivePaymentProviderProduct({
            paymentProviderConfigurationId: generateId("paymentProviderConfiguration"),
            productId,
            providerProductKey: uniqueKey("set-missing-config"),
          }),
        );
        expect(error).toBeInstanceOf(PaymentProviderProductValidationError);
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all and leaves the active flags unchanged",
    withCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* PaymentProviderProductService;
        const productId = yield* insertProduct(track);
        const configId = yield* insertConfiguration(track);
        const key = uniqueKey("set-forbidden");

        const created = yield* service.createPaymentProviderProduct({
          configuration: { productKey: key },
          paymentProviderConfigurationId: configId,
          productId,
        });
        track("providerProduct", created.id);

        const error = yield* Effect.flip(
          asUnauthorized(
            service.setActivePaymentProviderProduct({
              paymentProviderConfigurationId: configId,
              productId,
              providerProductKey: key,
            }),
          ),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);

        // Row remains active (the create left it active; the forbidden call wrote nothing).
        const row = yield* findProviderProductRow(created.id);
        expect(row?.isActive).toBe(true);
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );
});

describe("PaymentProviderProductService.updatePaymentProviderProduct", () => {
  test(
    "re-validates and updates the row's configuration & key, records an Updated audit entry, and invalidates the schema cache",
    withCleanup((track, _dispatches) =>
      Effect.gen(function* () {
        const service = yield* PaymentProviderProductService;
        const cache = yield* ProjectSchemaCache;

        const productId = yield* insertProduct(track);
        const configId = yield* insertConfiguration(track);
        const originalKey = uniqueKey("update-before");
        const newKey = uniqueKey("update-after");

        const created = yield* service.createPaymentProviderProduct({
          configuration: { productKey: originalKey },
          paymentProviderConfigurationId: configId,
          productId,
        });
        track("providerProduct", created.id);

        yield* cache.getByName(projectId).set({ marker: "present" }, 60_000);

        yield* service.updatePaymentProviderProduct({
          configuration: { extra: "field", productKey: newKey },
          id: created.id,
        });

        const row = yield* findProviderProductRow(created.id);
        expect(row?.providerProductKey).toBe(newKey);
        expect(row?.configuration).toMatchObject({
          extra: "field",
          productKey: newKey,
          validated: true,
        });

        const audit = yield* findAuditEntries(created.id);
        const updatedEntry = audit.find((entry) => entry.action === AuditLogAction.Updated);
        expect(updatedEntry).toBeDefined();
        expect(updatedEntry?.parentEntityId).toBe(productId);

        const cached = yield* cache.getByName(projectId).get();
        expect(cached).toBeNull();
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );

  test(
    "fails with PaymentProviderProductNotFoundError for an unknown id",
    Effect.gen(function* () {
      const service = yield* PaymentProviderProductService;
      const error = yield* Effect.flip(
        service.updatePaymentProviderProduct({
          configuration: { productKey: "x" },
          id: generateId("paymentProviderProduct"),
        }),
      );
      expect(error).toBeInstanceOf(PaymentProviderProductNotFoundError);
    }).pipe(Effect.provide(makeServiceLayer([])), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all and leaves the row unchanged",
    withCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* PaymentProviderProductService;
        const productId = yield* insertProduct(track);
        const configId = yield* insertConfiguration(track);
        const key = uniqueKey("update-forbidden");

        const created = yield* service.createPaymentProviderProduct({
          configuration: { productKey: key },
          paymentProviderConfigurationId: configId,
          productId,
        });
        track("providerProduct", created.id);

        const error = yield* Effect.flip(
          asUnauthorized(
            service.updatePaymentProviderProduct({
              configuration: { productKey: uniqueKey("update-forbidden-new") },
              id: created.id,
            }),
          ),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);

        const row = yield* findProviderProductRow(created.id);
        expect(row?.providerProductKey).toBe(key);
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );
});

describe("PaymentProviderProductService.deletePaymentProviderProduct", () => {
  test(
    "hard-deletes the row, records a Deleted audit entry, and invalidates the schema cache",
    withCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* PaymentProviderProductService;
        const cache = yield* ProjectSchemaCache;

        const productId = yield* insertProduct(track);
        const configId = yield* insertConfiguration(track);

        const created = yield* service.createPaymentProviderProduct({
          configuration: { productKey: uniqueKey("delete") },
          paymentProviderConfigurationId: configId,
          productId,
        });
        track("providerProduct", created.id);
        yield* cache.getByName(projectId).set({ marker: "present" }, 60_000);

        yield* service.deletePaymentProviderProduct({ id: created.id });

        const row = yield* findProviderProductRow(created.id);
        expect(row).toBeUndefined();

        const audit = yield* findAuditEntries(created.id);
        const deletedEntry = audit.find((entry) => entry.action === AuditLogAction.Deleted);
        expect(deletedEntry).toBeDefined();
        expect(deletedEntry?.parentEntityId).toBe(productId);
        expect(deletedEntry?.actorUserId).toBe(CoreTestFixture.userId);

        const cached = yield* cache.getByName(projectId).get();
        expect(cached).toBeNull();
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );

  test(
    "fails with PaymentProviderProductValidationError for an unknown id",
    Effect.gen(function* () {
      const service = yield* PaymentProviderProductService;
      const error = yield* Effect.flip(
        service.deletePaymentProviderProduct({ id: generateId("paymentProviderProduct") }),
      );
      expect(error).toBeInstanceOf(PaymentProviderProductValidationError);
    }).pipe(Effect.provide(makeServiceLayer([])), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all and retains the row",
    withCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* PaymentProviderProductService;
        const productId = yield* insertProduct(track);
        const configId = yield* insertConfiguration(track);

        const created = yield* service.createPaymentProviderProduct({
          configuration: { productKey: uniqueKey("delete-forbidden") },
          paymentProviderConfigurationId: configId,
          productId,
        });
        track("providerProduct", created.id);

        const error = yield* Effect.flip(
          asUnauthorized(service.deletePaymentProviderProduct({ id: created.id })),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);

        const row = yield* findProviderProductRow(created.id);
        expect(row).toBeDefined();
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );
});

describe("PaymentProviderProductService.getProviderProductsByProjectId", () => {
  test(
    "returns provider products for products in the project, joined with provider/configuration data",
    withCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* PaymentProviderProductService;
        const productId = yield* insertProduct(track);
        const configId = yield* insertConfiguration(track);
        const key = uniqueKey("by-project");

        const created = yield* service.createPaymentProviderProduct({
          configuration: { productKey: key },
          paymentProviderConfigurationId: configId,
          productId,
        });
        track("providerProduct", created.id);
        const developmentConfigId = yield* insertConfiguration(track, "development");
        const developmentMappingId = yield* insertRawProviderProduct(track, {
          configurationId: developmentConfigId,
          productId,
        });

        const list = yield* service.getProviderProductsByProjectId(projectId);
        const match = list.find((entry) => entry.id === created.id);
        expect(match).toBeDefined();
        expect(match?.productId).toBe(productId);
        expect(match?.paymentProviderConfigurationId).toBe(configId);
        expect(match?.providerId).toBe("stripe");
        expect(list.some((entry) => entry.id === developmentMappingId)).toBe(false);
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all",
    Effect.gen(function* () {
      const service = yield* PaymentProviderProductService;
      const error = yield* Effect.flip(
        asUnauthorized(service.getProviderProductsByProjectId(projectId)),
      );
      expect(error).toBeInstanceOf(ActionForbiddenError);
    }).pipe(Effect.provide(makeServiceLayer([])), CoreAuthSession.authenticate()),
  );
});

describe("PaymentProviderProductService.getProviderProductsByProductId", () => {
  test(
    "returns all provider products for the product",
    withCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* PaymentProviderProductService;
        const productId = yield* insertProduct(track);
        const configId = yield* insertConfiguration(track);
        const keyA = uniqueKey("by-product-a");
        const keyB = uniqueKey("by-product-b");

        const a = yield* service.createPaymentProviderProduct({
          configuration: { productKey: keyA },
          paymentProviderConfigurationId: configId,
          productId,
        });
        track("providerProduct", a.id);
        const b = yield* service.createPaymentProviderProduct({
          configuration: { productKey: keyB },
          paymentProviderConfigurationId: configId,
          productId,
        });
        track("providerProduct", b.id);
        const developmentConfigId = yield* insertConfiguration(track, "development");
        const developmentMappingId = yield* insertRawProviderProduct(track, {
          configurationId: developmentConfigId,
          productId,
        });

        const list = yield* service.getProviderProductsByProductId(productId);
        expect(list.some((entry) => entry.id === a.id && entry.providerProductKey === keyA)).toBe(
          true,
        );
        expect(list.some((entry) => entry.id === b.id && entry.providerProductKey === keyB)).toBe(
          true,
        );
        expect(list.some((entry) => entry.id === developmentMappingId)).toBe(false);
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );

  test(
    "fails with PaymentProviderProductValidationError when the product does not exist",
    Effect.gen(function* () {
      const service = yield* PaymentProviderProductService;
      const error = yield* Effect.flip(
        service.getProviderProductsByProductId(generateId("product")),
      );
      expect(error).toBeInstanceOf(PaymentProviderProductValidationError);
    }).pipe(Effect.provide(makeServiceLayer([])), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all",
    withCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* PaymentProviderProductService;
        const productId = yield* insertProduct(track);

        const error = yield* Effect.flip(
          asUnauthorized(service.getProviderProductsByProductId(productId)),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );
});

describe("PaymentProviderProductService.getProviderProductById", () => {
  test(
    "returns the matching provider-product row",
    withCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* PaymentProviderProductService;
        const productId = yield* insertProduct(track);
        const configId = yield* insertConfiguration(track);
        const key = uniqueKey("get-by-id");

        const created = yield* service.createPaymentProviderProduct({
          configuration: { productKey: key },
          paymentProviderConfigurationId: configId,
          productId,
        });
        track("providerProduct", created.id);

        const row = yield* service.getProviderProductById(created.id);
        expect(row.id).toBe(created.id);
        expect(row.productId).toBe(productId);
        expect(row.providerProductKey).toBe(key);
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );

  test(
    "fails with PaymentProviderProductNotFoundError for an unknown id",
    Effect.gen(function* () {
      const service = yield* PaymentProviderProductService;
      const error = yield* Effect.flip(
        service.getProviderProductById(generateId("paymentProviderProduct")),
      );
      expect(error).toBeInstanceOf(PaymentProviderProductNotFoundError);
    }).pipe(Effect.provide(makeServiceLayer([])), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all",
    withCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* PaymentProviderProductService;
        const productId = yield* insertProduct(track);
        const configId = yield* insertConfiguration(track);

        const created = yield* service.createPaymentProviderProduct({
          configuration: { productKey: uniqueKey("get-by-id-forbidden") },
          paymentProviderConfigurationId: configId,
          productId,
        });
        track("providerProduct", created.id);

        const error = yield* Effect.flip(
          asUnauthorized(service.getProviderProductById(created.id)),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);
      }),
    ).pipe(CoreAuthSession.authenticate()),
  );
});
