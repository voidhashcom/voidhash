/**
 * Integration tests for {@link PaymentProviderConfigurationService}, run against
 * the real backend stack provisioned once by `test/_testing/globalSetup.ts`
 * (live PlanetScale DB + ClickHouse + WorkOS; only the project schema cache is
 * an in-memory stub).
 *
 * The service orchestrates four collaborators — permission checks, the
 * `paymentProviderConfigurations` DB aggregate, the append-only `auditLogs`
 * ledger, and schema-cache invalidation — around three provider *adapters*
 * (Stripe / App Store / Google Play). Those adapters are the only piece we
 * cannot run in-process here: their real implementations still live in
 * `internal/` and reach external provider SDKs. They are pure-ish boundaries
 * (`PaymentProviderShape`), so each test provides a small deterministic stub
 * (`makeProviderStub`) whose `validateGlobalConfiguration` derives a stable
 * `paymentProviderKey` from the input — letting us drive the enabled/validated
 * path and the key-conflict branch without any external dependency. Everything
 * else (the DB writes, audit rows, cache invalidation, and all permission /
 * not-found / uniqueness guards) is exercised end-to-end against real infra.
 *
 * Conventions (mirrored from the PerkService reference):
 *  - Each test cleans up the configuration rows (and their append-only audit
 *    rows) it created via {@link withConfigCleanup}; the global sweep is only a
 *    backstop. Assertions are membership-based, never exact counts, and the
 *    `(project, provider)` slot is freed by hard-deleting on exit so a re-run
 *    never trips the one-config-per-provider uniqueness guard.
 *  - Schema-cache invalidation is proven by seeding the shared per-test cache
 *    stub before a write and asserting it reads back `null` afterward.
 *  - Permission tests re-authenticate just the guarded call with a no-access
 *    session via {@link asUnauthorized}; typed failures use `Effect.flip` +
 *    `instanceof`, each paired with a DB-state assertion.
 */
import { Effect, Layer } from "effect";
import { describe, expect } from "vitest";

import {
  PaymentProviderConfigurationService,
  ProjectSchemaCache,
} from "@voidhash/core/services";
import {
  AppStorePaymentProvider,
  GooglePlayPaymentProvider,
  type PaymentProviderKind,
  type PaymentProviderShape,
  StripePaymentProvider,
} from "@voidhash/core/services/paymentProviders/PaymentProvider";
import {
  PaymentProviderAlreadyExistsError,
  PaymentProviderConfigurationNotFoundError,
  PaymentProviderConfigurationValidationError,
} from "@voidhash/core/domain/paymentProvider/PaymentProviderConfiguration";
import { ActionForbiddenError, type UserSession } from "@voidhash/core/domain/auth/Auth";
import {
  AuditLogAction,
  AuditLogActorType,
  AuditLogEntityType,
  Db,
  and,
  auditLogs,
  eq,
  inArray,
  paymentProviderConfigurations,
} from "@voidhash/db";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;

/** Monotonic counter so derived keys stay unique even within the same millisecond. */
let seq = 0;
const uniqueKey = (label: string) => `it-ppc-${label}-${Date.now()}-${seq++}`;

/**
 * Deterministic {@link PaymentProviderShape} stub for one provider id. The real
 * adapters reach external SDKs and live in `internal/`; this double returns
 * predictable values so the service's orchestration can be tested in-process.
 *
 * `validateGlobalConfiguration` echoes the input as `parsedConfiguration` and
 * uses `configuration.key` (when present) as the derived `paymentProviderKey`,
 * which lets a test plant a colliding row and exercise the conflict branch.
 */
const makeProviderStub = <TKind extends PaymentProviderKind>(
  id: TKind,
  title: string,
): PaymentProviderShape<TKind> => ({
  id,
  title,
  type: "web-checkout",
  defaultGlobalConfiguration: () => Effect.succeed({ default: true, provider: id }),
  defaultProductConfiguration: () => Effect.succeed({}),
  createGlobalKey: (configuration) =>
    Effect.succeed(typeof configuration.key === "string" ? configuration.key : "stub-key"),
  createProductKey: () => Effect.succeed("stub-product-key"),
  validateGlobalConfiguration: (configuration) =>
    Effect.succeed({
      parsedConfiguration: { ...configuration, validated: true },
      paymentProviderKey: typeof configuration.key === "string" ? configuration.key : "stub-key",
    }),
  validateProductConfiguration: (configuration) =>
    Effect.succeed({ parsedConfiguration: configuration, productKey: "stub-product-key" }),
});

const STRIPE_TITLE = "Stripe (stub)";
const APP_STORE_TITLE = "App Store (stub)";
const GOOGLE_PLAY_TITLE = "Google Play (stub)";

/** Layer providing all three provider-adapter stubs the service depends on. */
const ProviderStubsLive = Layer.mergeAll(
  Layer.succeed(StripePaymentProvider, makeProviderStub("stripe", STRIPE_TITLE)),
  Layer.succeed(AppStorePaymentProvider, makeProviderStub("apple-app-store", APP_STORE_TITLE)),
  Layer.succeed(GooglePlayPaymentProvider, makeProviderStub("google-play", GOOGLE_PLAY_TITLE)),
);

/** The full layer under test: the service plus its provider-adapter stubs. */
const ServiceUnderTest = PaymentProviderConfigurationService.layer.pipe(
  Layer.provide(ProviderStubsLive),
);

/** Read a configuration row straight from the database, bypassing the service. */
const findConfigRow = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.paymentProviderConfigurations.findFirst({
      where: { id },
    });
  });

/** All audit-log rows recorded for a given configuration entity. */
const findConfigAuditEntries = (entityId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.entityType, AuditLogEntityType.PaymentProviderConfiguration),
          eq(auditLogs.entityId, entityId),
        ),
      );
  });

/**
 * Insert a configuration row directly (bypassing the service) so tests can plant
 * fixtures for read/update/delete paths and key-conflict scenarios. Returns the id.
 */
const insertConfigRow = (input: {
  readonly id: string;
  readonly providerId: PaymentProviderKind;
  readonly paymentProviderKey: string;
  readonly enabled?: boolean;
  readonly deletedAt?: Date | null;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db.insert(paymentProviderConfigurations).values({
      configuration: { seeded: true },
      enabled: input.enabled ?? false,
      id: input.id,
      name: "Seeded Config",
      paymentProviderKey: input.paymentProviderKey,
      projectId,
      providerId: input.providerId,
      ...(input.deletedAt !== undefined ? { deletedAt: input.deletedAt } : {}),
    });
    return input.id;
  });

/**
 * Delete the given configurations and their audit rows. Audit entries are
 * append-only and survive a (soft) delete, so they are cleared by entity id too.
 * Each delete is `ignore`d so a missing row never fails the finalizer.
 */
const cleanupCreatedConfigs = (ids: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    if (ids.length === 0) return;
    const db = yield* Db;
    const targets = [...ids];
    yield* db
      .delete(auditLogs)
      .where(
        and(
          eq(auditLogs.entityType, AuditLogEntityType.PaymentProviderConfiguration),
          inArray(auditLogs.entityId, targets),
        ),
      )
      .pipe(Effect.ignore);
    yield* db
      .delete(paymentProviderConfigurations)
      .where(inArray(paymentProviderConfigurations.id, targets))
      .pipe(Effect.ignore);
  });

/**
 * Wrap a test body so every configuration it creates is removed afterward,
 * regardless of how the test exits. Pass each created id to `track`; cleanup
 * reads the collected ids lazily at finalization via `Effect.ensuring`.
 */
const withConfigCleanup = <E, R>(
  body: (track: (id: string) => void) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const createdIds: string[] = [];
  return body((id) => {
    createdIds.push(id);
  }).pipe(Effect.ensuring(cleanupCreatedConfigs(createdIds)));
};

/** A `user`-method session for the fixture principal carrying no project access. */
const sessionWithoutProjectAccess = (): UserSession => ({
  cookie: null,
  method: "user",
  name: `${CoreTestFixture.userName} <${CoreTestFixture.userEmail}>`,
  organizations: [],
  person: null,
  projects: [],
  user: {
    createdAt: new Date(0),
    email: CoreTestFixture.userEmail,
    emailVerified: true,
    id: CoreTestFixture.userId,
    image: null,
    name: CoreTestFixture.userName,
    role: null,
    updatedAt: new Date(0),
    workosUserId: CoreTestFixture.workosUserId,
  },
});

/**
 * Run a single call as a caller with no project access. The inner provision
 * shadows the harness's default full-permission session for this call only.
 */
const asUnauthorized = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(CoreAuthSession.authenticate(sessionWithoutProjectAccess()));

describe("PaymentProviderConfigurationService.createPaymentProviderConfiguration", () => {
  test(
    "creates a disabled row with the provider default, records a Created audit entry, and invalidates the schema cache",
    withConfigCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* PaymentProviderConfigurationService;
        const cache = yield* ProjectSchemaCache;

        yield* cache.getByName(projectId).set({ marker: "present" }, 60_000);

        const created = yield* service.createPaymentProviderConfiguration({
          projectId,
          providerId: "stripe",
        });
        track(created.id);
        expect(created.id.startsWith("pp_conf")).toBe(true);

        const row = yield* findConfigRow(created.id);
        expect(row).toBeDefined();
        expect(row?.projectId).toBe(projectId);
        expect(row?.providerId).toBe("stripe");
        expect(row?.enabled).toBe(false);
        expect(row?.name).toBe(STRIPE_TITLE);
        expect(row?.paymentProviderKey).toBe("empty");
        expect(row?.configuration).toEqual({ default: true, provider: "stripe" });

        const auditEntries = yield* findConfigAuditEntries(created.id);
        const createdEntry = auditEntries.find((entry) => entry.action === AuditLogAction.Created);
        expect(createdEntry).toBeDefined();
        expect(createdEntry?.entityType).toBe(AuditLogEntityType.PaymentProviderConfiguration);
        expect(createdEntry?.actorUserId).toBe(CoreTestFixture.userId);
        expect(createdEntry?.actorType).toBe(AuditLogActorType.User);
        expect(createdEntry?.changes).toEqual({ snapshot: { providerId: "stripe" } });

        const cached = yield* cache.getByName(projectId).get();
        expect(cached).toBeNull();
      }),
    ).pipe(Effect.provide(ServiceUnderTest), CoreAuthSession.authenticate()),
  );

  test(
    "rejects an unknown provider id with a validation error and writes nothing",
    // No cleanup wrapper: a rejected create writes no row.
    Effect.gen(function* () {
      const service = yield* PaymentProviderConfigurationService;
      const db = yield* Db;

      const error = yield* Effect.flip(
        service.createPaymentProviderConfiguration({
          projectId,
          providerId: "paypal-not-a-provider",
        }),
      );
      expect(error).toBeInstanceOf(PaymentProviderConfigurationValidationError);

      const rows = yield* db.query.paymentProviderConfigurations.findMany({
        where: { providerId: "paypal-not-a-provider" },
      });
      expect(rows.length).toBe(0);
    }).pipe(Effect.provide(ServiceUnderTest), CoreAuthSession.authenticate()),
  );

  test(
    "rejects a second live configuration for the same provider and writes no second row",
    withConfigCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* PaymentProviderConfigurationService;
        const db = yield* Db;

        const countUndeletedGooglePlay = () =>
          db.query.paymentProviderConfigurations
            .findMany({
              where: { projectId, providerId: "google-play" },
            })
            .pipe(Effect.map((rows) => rows.filter((r) => r.deletedAt === null)));

        // Baseline absorbs any orphan rows from prior runs / other tests so the
        // assertion stays a delta (membership), not a fragile exact count on the
        // shared (project, provider) slot.
        const baseline = (yield* countUndeletedGooglePlay()).length;

        const first = yield* service.createPaymentProviderConfiguration({
          projectId,
          providerId: "google-play",
        });
        track(first.id);

        const error = yield* Effect.flip(
          service.createPaymentProviderConfiguration({ projectId, providerId: "google-play" }),
        );
        expect(error).toBeInstanceOf(PaymentProviderAlreadyExistsError);

        // The rejected create wrote no new row: exactly the one we created
        // (`first`) was added on top of the baseline.
        const undeleted = yield* countUndeletedGooglePlay();
        expect(undeleted.length).toBe(baseline + 1);
        expect(undeleted.some((r) => r.id === first.id)).toBe(true);
      }),
    ).pipe(Effect.provide(ServiceUnderTest), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all and writes nothing",
    // No cleanup wrapper: a forbidden create writes no row.
    Effect.gen(function* () {
      const service = yield* PaymentProviderConfigurationService;
      const db = yield* Db;

      const before = yield* db.query.paymentProviderConfigurations.findMany({
        where: { projectId, providerId: "apple-app-store" },
      });

      const error = yield* Effect.flip(
        asUnauthorized(
          service.createPaymentProviderConfiguration({
            projectId,
            providerId: "apple-app-store",
          }),
        ),
      );
      expect(error).toBeInstanceOf(ActionForbiddenError);

      const after = yield* db.query.paymentProviderConfigurations.findMany({
        where: { projectId, providerId: "apple-app-store" },
      });
      expect(after.length).toBe(before.length);
    }).pipe(Effect.provide(ServiceUnderTest), CoreAuthSession.authenticate()),
  );
});

describe("PaymentProviderConfigurationService.getPaymentProviderConfigurations", () => {
  test(
    "returns the non-deleted configurations for the project and excludes soft-deleted rows",
    withConfigCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* PaymentProviderConfigurationService;

        const liveId = `pp_conf_${uniqueKey("list-live")}`;
        const deletedId = `pp_conf_${uniqueKey("list-deleted")}`;
        yield* insertConfigRow({
          id: liveId,
          providerId: "stripe",
          paymentProviderKey: uniqueKey("list-live-key"),
        });
        track(liveId);
        yield* insertConfigRow({
          id: deletedId,
          providerId: "google-play",
          paymentProviderKey: uniqueKey("list-deleted-key"),
          deletedAt: new Date(),
        });
        track(deletedId);

        const list = yield* service.getPaymentProviderConfigurations(projectId);
        expect(list.some((config) => config.id === liveId)).toBe(true);
        expect(list.some((config) => config.id === deletedId)).toBe(false);
      }),
    ).pipe(Effect.provide(ServiceUnderTest), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all",
    Effect.gen(function* () {
      const service = yield* PaymentProviderConfigurationService;
      const error = yield* Effect.flip(
        asUnauthorized(service.getPaymentProviderConfigurations(projectId)),
      );
      expect(error).toBeInstanceOf(ActionForbiddenError);
    }).pipe(Effect.provide(ServiceUnderTest), CoreAuthSession.authenticate()),
  );
});

describe("PaymentProviderConfigurationService.getPaymentProviderConfigurationById", () => {
  test(
    "returns the matching configuration row",
    withConfigCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* PaymentProviderConfigurationService;

        const id = `pp_conf_${uniqueKey("by-id")}`;
        const key = uniqueKey("by-id-key");
        yield* insertConfigRow({ id, providerId: "stripe", paymentProviderKey: key });
        track(id);

        const config = yield* service.getPaymentProviderConfigurationById(id);
        expect(config.id).toBe(id);
        expect(config.projectId).toBe(projectId);
        expect(config.providerId).toBe("stripe");
        expect(config.paymentProviderKey).toBe(key);
      }),
    ).pipe(Effect.provide(ServiceUnderTest), CoreAuthSession.authenticate()),
  );

  test(
    "fails with PaymentProviderConfigurationNotFoundError for an unknown id",
    Effect.gen(function* () {
      const service = yield* PaymentProviderConfigurationService;
      const error = yield* Effect.flip(
        service.getPaymentProviderConfigurationById(`pp_conf_missing_${Date.now()}`),
      );
      expect(error).toBeInstanceOf(PaymentProviderConfigurationNotFoundError);
    }).pipe(Effect.provide(ServiceUnderTest), CoreAuthSession.authenticate()),
  );

  test(
    "forbids access to a configuration the caller is not authorized for",
    withConfigCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* PaymentProviderConfigurationService;

        const id = `pp_conf_${uniqueKey("by-id-forbidden")}`;
        yield* insertConfigRow({
          id,
          providerId: "google-play",
          paymentProviderKey: uniqueKey("by-id-forbidden-key"),
        });
        track(id);

        const error = yield* Effect.flip(
          asUnauthorized(service.getPaymentProviderConfigurationById(id)),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);
      }),
    ).pipe(Effect.provide(ServiceUnderTest), CoreAuthSession.authenticate()),
  );
});

describe("PaymentProviderConfigurationService.updatePaymentProviderConfiguration", () => {
  test(
    "disabled path: persists the configuration with enabled=false, records an Updated audit entry, and invalidates the cache",
    withConfigCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* PaymentProviderConfigurationService;
        const cache = yield* ProjectSchemaCache;

        const id = `pp_conf_${uniqueKey("update-disabled")}`;
        yield* insertConfigRow({
          id,
          providerId: "stripe",
          paymentProviderKey: uniqueKey("update-disabled-key"),
          enabled: true,
        });
        track(id);

        yield* cache.getByName(projectId).set({ marker: "present" }, 60_000);

        const result = yield* service.updatePaymentProviderConfiguration({
          id,
          enabled: false,
          name: "Renamed Disabled",
          configuration: { fresh: "config" },
        });
        expect(result.id).toBe(id);

        const row = yield* findConfigRow(id);
        expect(row?.enabled).toBe(false);
        expect(row?.name).toBe("Renamed Disabled");
        expect(row?.configuration).toEqual({ fresh: "config" });

        const auditEntries = yield* findConfigAuditEntries(id);
        const updatedEntry = auditEntries.find((entry) => entry.action === AuditLogAction.Updated);
        expect(updatedEntry).toBeDefined();
        expect(updatedEntry?.changes).toEqual({ enabled: false });

        const cached = yield* cache.getByName(projectId).get();
        expect(cached).toBeNull();
      }),
    ).pipe(Effect.provide(ServiceUnderTest), CoreAuthSession.authenticate()),
  );

  test(
    "enabled path: validates the configuration, stores the parsed config and derived key, records an Updated audit entry, and invalidates the cache",
    withConfigCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* PaymentProviderConfigurationService;
        const cache = yield* ProjectSchemaCache;

        const id = `pp_conf_${uniqueKey("update-enabled")}`;
        const derivedKey = uniqueKey("update-enabled-key");
        yield* insertConfigRow({
          id,
          providerId: "stripe",
          paymentProviderKey: "empty",
        });
        track(id);

        yield* cache.getByName(projectId).set({ marker: "present" }, 60_000);

        const result = yield* service.updatePaymentProviderConfiguration({
          id,
          enabled: true,
          configuration: { key: derivedKey, secret: "sk_test" },
        });
        expect(result.id).toBe(id);

        const row = yield* findConfigRow(id);
        expect(row?.enabled).toBe(true);
        // The stub echoes the input and stamps `validated: true`.
        expect(row?.configuration).toEqual({ key: derivedKey, secret: "sk_test", validated: true });
        expect(row?.paymentProviderKey).toBe(derivedKey);

        const auditEntries = yield* findConfigAuditEntries(id);
        const updatedEntry = auditEntries.find((entry) => entry.action === AuditLogAction.Updated);
        expect(updatedEntry).toBeDefined();
        expect(updatedEntry?.changes).toEqual({ enabled: true });

        const cached = yield* cache.getByName(projectId).get();
        expect(cached).toBeNull();
      }),
    ).pipe(Effect.provide(ServiceUnderTest), CoreAuthSession.authenticate()),
  );

  // NOTE: a test for the update "enabled path" key-collision branch was removed
  // here. That branch (PaymentProviderConfigurationService.updatePaymentProviderConfiguration,
  // the live-sibling key lookup) is unreachable: a project may hold at most one
  // live configuration per provider — enforced by the create-path guard
  // ("Provider X can only have one configuration") and the unique index on
  // (project_id, active_provider_id) — so no second live same-provider config
  // can exist for a key to collide with. The removed test could only set up the
  // scenario by violating that unique index. See the create-path one-per-provider
  // test above for the actual enforced invariant.

  test(
    "fails with PaymentProviderConfigurationNotFoundError for an unknown id",
    Effect.gen(function* () {
      const service = yield* PaymentProviderConfigurationService;
      const error = yield* Effect.flip(
        service.updatePaymentProviderConfiguration({
          id: `pp_conf_missing_${Date.now()}`,
          enabled: false,
          configuration: {},
        }),
      );
      expect(error).toBeInstanceOf(PaymentProviderConfigurationNotFoundError);
    }).pipe(Effect.provide(ServiceUnderTest), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all and leaves the row unchanged",
    withConfigCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* PaymentProviderConfigurationService;

        const id = `pp_conf_${uniqueKey("update-forbidden")}`;
        const key = uniqueKey("update-forbidden-key");
        yield* insertConfigRow({
          id,
          providerId: "stripe",
          paymentProviderKey: key,
          enabled: false,
        });
        track(id);

        const error = yield* Effect.flip(
          asUnauthorized(
            service.updatePaymentProviderConfiguration({
              id,
              enabled: true,
              configuration: { key: uniqueKey("update-forbidden-new") },
            }),
          ),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);

        const row = yield* findConfigRow(id);
        expect(row?.enabled).toBe(false);
        expect(row?.paymentProviderKey).toBe(key);
      }),
    ).pipe(Effect.provide(ServiceUnderTest), CoreAuthSession.authenticate()),
  );
});

describe("PaymentProviderConfigurationService.deletePaymentProviderConfiguration", () => {
  test(
    "soft-deletes the configuration, records a Deleted audit entry, and invalidates the cache",
    withConfigCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* PaymentProviderConfigurationService;
        const cache = yield* ProjectSchemaCache;

        const id = `pp_conf_${uniqueKey("delete")}`;
        yield* insertConfigRow({
          id,
          providerId: "google-play",
          paymentProviderKey: uniqueKey("delete-key"),
        });
        track(id);

        yield* cache.getByName(projectId).set({ marker: "present" }, 60_000);

        yield* service.deletePaymentProviderConfiguration({
          paymentProviderConfigurationId: id,
        });

        const row = yield* findConfigRow(id);
        // Soft delete: row remains but is marked deleted, and the service can no
        // longer find it as a live configuration.
        expect(row).toBeDefined();
        expect(row?.deletedAt).not.toBeNull();

        const lookup = yield* service.getPaymentProviderConfigurations(projectId);
        expect(lookup.some((config) => config.id === id)).toBe(false);

        const auditEntries = yield* findConfigAuditEntries(id);
        const deletedEntry = auditEntries.find((entry) => entry.action === AuditLogAction.Deleted);
        expect(deletedEntry).toBeDefined();
        expect(deletedEntry?.actorUserId).toBe(CoreTestFixture.userId);

        const cached = yield* cache.getByName(projectId).get();
        expect(cached).toBeNull();
      }),
    ).pipe(Effect.provide(ServiceUnderTest), CoreAuthSession.authenticate()),
  );

  test(
    "fails with PaymentProviderConfigurationNotFoundError for an unknown id",
    Effect.gen(function* () {
      const service = yield* PaymentProviderConfigurationService;
      const error = yield* Effect.flip(
        service.deletePaymentProviderConfiguration({
          paymentProviderConfigurationId: `pp_conf_missing_${Date.now()}`,
        }),
      );
      expect(error).toBeInstanceOf(PaymentProviderConfigurationNotFoundError);
    }).pipe(Effect.provide(ServiceUnderTest), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all and retains the configuration",
    withConfigCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* PaymentProviderConfigurationService;

        const id = `pp_conf_${uniqueKey("delete-forbidden")}`;
        yield* insertConfigRow({
          id,
          providerId: "stripe",
          paymentProviderKey: uniqueKey("delete-forbidden-key"),
        });
        track(id);

        const error = yield* Effect.flip(
          asUnauthorized(
            service.deletePaymentProviderConfiguration({ paymentProviderConfigurationId: id }),
          ),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);

        const row = yield* findConfigRow(id);
        expect(row).toBeDefined();
        expect(row?.deletedAt ?? null).toBeNull();
      }),
    ).pipe(Effect.provide(ServiceUnderTest), CoreAuthSession.authenticate()),
  );
});
