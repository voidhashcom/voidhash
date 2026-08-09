/**
 * Integration tests for {@link AppStorePaymentProviderServiceQueries}, run
 * against the real backend stack provisioned once by
 * `test/_testing/globalSetup.ts` (live PlanetScale DB; only the project schema
 * cache is an in-memory stub).
 *
 * This module is a thin layer of DB-bound query primitives with no business
 * logic, no permission checks, and no domain errors — every failure mode just
 * propagates the underlying `DbError`. So these tests do not exercise
 * `ActionForbiddenError` / tagged-error paths (there are none); instead each
 * test seeds the minimal rows the query reads, runs the primitive, and asserts
 * the returned value (and, for the write primitives, the *persisted* row read
 * back straight from the database).
 *
 * Conventions used throughout:
 *  - Every test shares the one seeded fixture project ({@link CoreTestFixture})
 *    but cleans up after itself: {@link withCleanup} deletes every row it
 *    created on exit, success or failure, deepest foreign-key dependents first.
 *    The global teardown sweep is only a backstop. Identifiers are made unique
 *    per call via {@link uniqueId} so a leftover row from a crashed run can't
 *    collide, and assertions stay membership-based (`.some(...)`/by-id).
 *  - Parent rows the fixture does NOT seed (persons, payment-provider configs +
 *    products, subscriptions, transactions, purchases, notification rows) are
 *    inserted raw in each test and tracked for cleanup.
 *  - The service requires only `Db`, which the harness provides; the test
 *    provides `AppStorePaymentProviderServiceQueries.layer` and authenticates
 *    with the default fixture session purely to satisfy the harness shape (the
 *    primitives never read `AuthSession`).
 */
import { DateTime, Effect, Option } from "effect";
import { describe, expect } from "vitest";

import { AppStorePaymentProviderServiceQueries } from "@voidhash/core/services/paymentProviders/appStore/payment-provider-service-queries";
import {
  Db,
  PersonOrigin,
  inArray,
  paymentProviderConfigurationProducts,
  paymentProviderConfigurations,
  paymentProviderNotificationProcessed,
  personExternalIdentifiers,
  personIdentities,
  persons,
  purchases,
  subscriptions,
  transactions,
} from "@voidhash/db";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;

/** Wall-clock helpers — `DateTime` equivalents of `nowMillis()` / `new Date(...)`. */
const nowMillis = (): number => DateTime.toEpochMillis(DateTime.nowUnsafe());
const nowDate = (): Date => DateTime.toDateUtc(DateTime.nowUnsafe());
const instant = (iso: string): Date => DateTime.toDateUtc(DateTime.makeUnsafe(iso));

/** Monotonic counter so ids stay unique even within the same millisecond. */
let idSeq = 0;
const uniqueId = (label: string) => `it-appstore-${label}-${nowMillis()}-${idSeq++}`;

/**
 * Raw-insert builders for the parent rows the fixture does not seed. Each
 * returns the row's id (or the row), inserting only the NOT-NULL columns the
 * queries under test read back. Inserts run via `yield* Db` + native builders.
 */
const insertPerson = (overrides: {
  readonly id: string;
  readonly origin?: number;
  readonly projectIdOverride?: string;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db.insert(persons).values({
      id: overrides.id,
      origin: overrides.origin ?? PersonOrigin.IOS,
      projectId: overrides.projectIdOverride ?? projectId,
    });
    return overrides.id;
  });

const insertPersonIdentity = (input: {
  readonly id: string;
  readonly personId: string;
  readonly distinctId: string;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db.insert(personIdentities).values({
      distinctId: input.distinctId,
      id: input.id,
      personId: input.personId,
      projectId,
    });
    return input.id;
  });

const insertProviderConfig = (input: { readonly id: string; readonly deletedAt?: Date | null }) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db.insert(paymentProviderConfigurations).values({
      deletedAt: input.deletedAt ?? null,
      id: input.id,
      name: "App Store",
      paymentProviderKey: `com.test.${input.id}`,
      projectId,
      providerId: "app_store",
    });
    return input.id;
  });

const insertProviderConfigProduct = (input: {
  readonly id: string;
  readonly paymentProviderConfigurationId: string;
  readonly productId: string;
  readonly providerProductKey: string;
  readonly isActive?: boolean;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db.insert(paymentProviderConfigurationProducts).values({
      id: input.id,
      isActive: input.isActive ?? true,
      paymentProviderConfigurationId: input.paymentProviderConfigurationId,
      productId: input.productId,
      providerProductKey: input.providerProductKey,
    });
    return input.id;
  });

const insertSubscription = (input: {
  readonly id: string;
  readonly personId: string;
  readonly storeSubscriptionId: string;
  readonly paymentProviderConfigurationProductId: string;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const now = nowDate();
    yield* db.insert(subscriptions).values({
      id: input.id,
      initialTransactionId: `${input.id}-init`,
      latestTransactionId: `${input.id}-latest`,
      paymentProviderConfigurationProductId: input.paymentProviderConfigurationProductId,
      personId: input.personId,
      purchasedAt: now,
      startsAt: now,
      status: 1, // SubscriptionStatus.Active
      storeSubscriptionId: input.storeSubscriptionId,
    });
    return input.id;
  });

const insertTransaction = (input: {
  readonly id: string;
  readonly personId: string;
  readonly storeTransactionId: string;
  readonly paymentProviderConfigurationProductId: string;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db.insert(transactions).values({
      amount: 999,
      currency: "USD",
      id: input.id,
      occurredAt: nowDate(),
      paymentProviderConfigurationProductId: input.paymentProviderConfigurationProductId,
      personId: input.personId,
      storeTransactionId: input.storeTransactionId,
    });
    return input.id;
  });

const insertPurchase = (input: {
  readonly id: string;
  readonly personId: string;
  readonly providerKey: string;
  readonly paymentProviderConfigurationProductId: string;
  readonly type?: number;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db.insert(purchases).values({
      id: input.id,
      paymentProviderConfigurationProductId: input.paymentProviderConfigurationProductId,
      personId: input.personId,
      providerKey: input.providerKey,
      type: input.type ?? 1, // PurchaseType.OneTime
    });
    return input.id;
  });

/** Insert a `payment_provider_notification_processed` row directly. */
const insertNotificationRow = (input: {
  readonly id: string;
  readonly paymentProviderConfigurationId: string;
  readonly notificationUuid: string;
  readonly result: string;
  readonly processedAt?: Date;
  readonly parkedUntilProviderProductKey?: string | null;
  readonly parkedUntilOriginalTransactionId?: string | null;
  readonly parkedRawPayload?: unknown;
}) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db.insert(paymentProviderNotificationProcessed).values({
      id: input.id,
      notificationType: "TEST",
      notificationUuid: input.notificationUuid,
      parkedRawPayload: input.parkedRawPayload ?? null,
      parkedUntilOriginalTransactionId: input.parkedUntilOriginalTransactionId ?? null,
      parkedUntilProviderProductKey: input.parkedUntilProviderProductKey ?? null,
      paymentProviderConfigurationId: input.paymentProviderConfigurationId,
      processedAt: input.processedAt ?? nowDate(),
      providerId: "app_store",
      result: input.result,
      source: "webhook",
    });
    return input.id;
  });

/** Read a notification row straight from the database. */
const findNotificationRow = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.paymentProviderNotificationProcessed.findFirst({
      where: { id },
    });
  });

/** Read an external-identifier row straight from the database. */
const findExternalIdentifierRow = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.personExternalIdentifiers.findFirst({
      where: { id },
    });
  });

/**
 * Tracks rows created by a test and deletes them on exit, regardless of how the
 * test exits. Cleanup reads the collected ids lazily at finalization via
 * `Effect.ensuring`, deepest foreign-key dependents first, each `ignore`d so a
 * missing row never turns the finalizer into a failure.
 */
interface Tracker {
  notifications: string[];
  subscriptions: string[];
  transactions: string[];
  purchases: string[];
  externalIdentifiers: string[];
  personIdentities: string[];
  configProducts: string[];
  configs: string[];
  persons: string[];
}

const cleanup = (t: Tracker) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const del = <A>(eff: Effect.Effect<A, unknown, never>) => eff.pipe(Effect.ignore);

    if (t.notifications.length > 0) {
      yield* del(
        db
          .delete(paymentProviderNotificationProcessed)
          .where(inArray(paymentProviderNotificationProcessed.id, t.notifications)),
      );
    }
    if (t.subscriptions.length > 0) {
      yield* del(db.delete(subscriptions).where(inArray(subscriptions.id, t.subscriptions)));
    }
    if (t.transactions.length > 0) {
      yield* del(db.delete(transactions).where(inArray(transactions.id, t.transactions)));
    }
    if (t.purchases.length > 0) {
      yield* del(db.delete(purchases).where(inArray(purchases.id, t.purchases)));
    }
    if (t.externalIdentifiers.length > 0) {
      yield* del(
        db
          .delete(personExternalIdentifiers)
          .where(inArray(personExternalIdentifiers.id, t.externalIdentifiers)),
      );
    }
    if (t.personIdentities.length > 0) {
      yield* del(
        db.delete(personIdentities).where(inArray(personIdentities.id, t.personIdentities)),
      );
    }
    if (t.configProducts.length > 0) {
      yield* del(
        db
          .delete(paymentProviderConfigurationProducts)
          .where(inArray(paymentProviderConfigurationProducts.id, t.configProducts)),
      );
    }
    if (t.configs.length > 0) {
      yield* del(
        db
          .delete(paymentProviderConfigurations)
          .where(inArray(paymentProviderConfigurations.id, t.configs)),
      );
    }
    if (t.persons.length > 0) {
      yield* del(db.delete(persons).where(inArray(persons.id, t.persons)));
    }
  });

const withCleanup = <E, R>(
  body: (t: Tracker) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const t: Tracker = {
    configProducts: [],
    configs: [],
    externalIdentifiers: [],
    notifications: [],
    personIdentities: [],
    persons: [],
    purchases: [],
    subscriptions: [],
    transactions: [],
  };
  return body(t).pipe(Effect.ensuring(cleanup(t)));
};

describe("AppStorePaymentProviderServiceQueries.findPaymentProviderConfigurationById", () => {
  test(
    "returns the configuration when active (deletedAt is null)",
    withCleanup((t) =>
      Effect.gen(function* () {
        const queries = yield* AppStorePaymentProviderServiceQueries;
        const id = uniqueId("cfg-active");
        t.configs.push(yield* insertProviderConfig({ id }));

        const found = yield* queries.findPaymentProviderConfigurationById(id);
        expect(found).toBeDefined();
        expect(found?.id).toBe(id);
        expect(found?.projectId).toBe(projectId);
      }),
    ).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "returns undefined when deletedAt is set",
    withCleanup((t) =>
      Effect.gen(function* () {
        const queries = yield* AppStorePaymentProviderServiceQueries;
        const id = uniqueId("cfg-deleted");
        t.configs.push(yield* insertProviderConfig({ deletedAt: nowDate(), id }));

        const found = yield* queries.findPaymentProviderConfigurationById(id);
        expect(found).toBeUndefined();
      }),
    ).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "returns undefined when the id is not found",
    Effect.gen(function* () {
      const queries = yield* AppStorePaymentProviderServiceQueries;
      const found = yield* queries.findPaymentProviderConfigurationById(uniqueId("cfg-missing"));
      expect(found).toBeUndefined();
    }).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("AppStorePaymentProviderServiceQueries.findPaymentProviderConfigurationsByProjectId", () => {
  test(
    "returns all active configurations for a project and omits soft-deleted ones",
    withCleanup((t) =>
      Effect.gen(function* () {
        const queries = yield* AppStorePaymentProviderServiceQueries;
        const activeId = uniqueId("cfgs-active");
        const deletedId = uniqueId("cfgs-deleted");
        t.configs.push(yield* insertProviderConfig({ id: activeId }));
        t.configs.push(yield* insertProviderConfig({ deletedAt: nowDate(), id: deletedId }));

        const list = yield* queries.findPaymentProviderConfigurationsByProjectId(projectId);
        expect(list.some((c) => c.id === activeId)).toBe(true);
        expect(list.some((c) => c.id === deletedId)).toBe(false);
        expect(list.every((c) => c.projectId === projectId)).toBe(true);
      }),
    ).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("AppStorePaymentProviderServiceQueries.findPaymentProviderConfigurationProductByPrimaryKey", () => {
  test(
    "returns the product when isActive=true",
    withCleanup((t) =>
      Effect.gen(function* () {
        const queries = yield* AppStorePaymentProviderServiceQueries;
        const configId = uniqueId("ppcp-active-cfg");
        const productKey = uniqueId("ppcp-active-key");
        const productRowId = uniqueId("ppcp-active-prod");
        t.configs.push(yield* insertProviderConfig({ id: configId }));
        t.configProducts.push(
          yield* insertProviderConfigProduct({
            id: productRowId,
            isActive: true,
            paymentProviderConfigurationId: configId,
            productId: uniqueId("ppcp-active-pid"),
            providerProductKey: productKey,
          }),
        );

        const found = yield* queries.findPaymentProviderConfigurationProductByPrimaryKey({
          paymentProviderConfigurationId: configId,
          providerProductKey: productKey,
        });
        expect(found).toBeDefined();
        expect(found?.id).toBe(productRowId);
        expect(found?.isActive).toBe(true);
      }),
    ).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "returns undefined when isActive=false",
    withCleanup((t) =>
      Effect.gen(function* () {
        const queries = yield* AppStorePaymentProviderServiceQueries;
        const configId = uniqueId("ppcp-inactive-cfg");
        const productKey = uniqueId("ppcp-inactive-key");
        t.configs.push(yield* insertProviderConfig({ id: configId }));
        t.configProducts.push(
          yield* insertProviderConfigProduct({
            id: uniqueId("ppcp-inactive-prod"),
            isActive: false,
            paymentProviderConfigurationId: configId,
            productId: uniqueId("ppcp-inactive-pid"),
            providerProductKey: productKey,
          }),
        );

        const found = yield* queries.findPaymentProviderConfigurationProductByPrimaryKey({
          paymentProviderConfigurationId: configId,
          providerProductKey: productKey,
        });
        expect(found).toBeUndefined();
      }),
    ).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "returns undefined when not found",
    Effect.gen(function* () {
      const queries = yield* AppStorePaymentProviderServiceQueries;
      const found = yield* queries.findPaymentProviderConfigurationProductByPrimaryKey({
        paymentProviderConfigurationId: uniqueId("ppcp-missing-cfg"),
        providerProductKey: uniqueId("ppcp-missing-key"),
      });
      expect(found).toBeUndefined();
    }).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("AppStorePaymentProviderServiceQueries.findProjectById", () => {
  test(
    "returns the project when found",
    Effect.gen(function* () {
      const queries = yield* AppStorePaymentProviderServiceQueries;
      const found = yield* queries.findProjectById(projectId);
      expect(found).toBeDefined();
      expect(found?.id).toBe(projectId);
    }).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "returns undefined when not found",
    Effect.gen(function* () {
      const queries = yield* AppStorePaymentProviderServiceQueries;
      const found = yield* queries.findProjectById(uniqueId("project-missing"));
      expect(found).toBeUndefined();
    }).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("AppStorePaymentProviderServiceQueries.findPersonIdentityByDistinctId", () => {
  test(
    "returns Option.some with the personId when found",
    withCleanup((t) =>
      Effect.gen(function* () {
        const queries = yield* AppStorePaymentProviderServiceQueries;
        const personId = uniqueId("pibd-person");
        const distinctId = uniqueId("pibd-distinct");
        t.persons.push(yield* insertPerson({ id: personId }));
        t.personIdentities.push(
          yield* insertPersonIdentity({ distinctId, id: uniqueId("pibd-ident"), personId }),
        );

        const result = yield* queries.findPersonIdentityByDistinctId({ distinctId, projectId });
        expect(Option.isSome(result)).toBe(true);
        if (Option.isSome(result)) {
          expect(result.value.personId).toBe(personId);
        }
      }),
    ).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "returns Option.none when not found",
    Effect.gen(function* () {
      const queries = yield* AppStorePaymentProviderServiceQueries;
      const result = yield* queries.findPersonIdentityByDistinctId({
        distinctId: uniqueId("pibd-missing"),
        projectId,
      });
      expect(Option.isNone(result)).toBe(true);
    }).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("AppStorePaymentProviderServiceQueries.findExternalIdentifier", () => {
  test(
    "returns Option.some with id and personId when found",
    withCleanup((t) =>
      Effect.gen(function* () {
        const queries = yield* AppStorePaymentProviderServiceQueries;
        const personId = uniqueId("fei-person");
        const extId = uniqueId("fei-ext");
        const identifier = uniqueId("fei-identifier");
        t.persons.push(yield* insertPerson({ id: personId }));
        const db = yield* Db;
        yield* db.insert(personExternalIdentifiers).values({
          id: extId,
          identifier,
          isDefault: true,
          personId,
          projectId,
          serviceId: "appstore",
        });
        t.externalIdentifiers.push(extId);

        const result = yield* queries.findExternalIdentifier({
          identifier,
          projectId,
          serviceId: "appstore",
        });
        expect(Option.isSome(result)).toBe(true);
        if (Option.isSome(result)) {
          expect(result.value.id).toBe(extId);
          expect(result.value.personId).toBe(personId);
        }
      }),
    ).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "returns Option.none when not found",
    Effect.gen(function* () {
      const queries = yield* AppStorePaymentProviderServiceQueries;
      const result = yield* queries.findExternalIdentifier({
        identifier: uniqueId("fei-missing"),
        projectId,
        serviceId: "appstore",
      });
      expect(Option.isNone(result)).toBe(true);
    }).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("AppStorePaymentProviderServiceQueries.createExternalIdentifier", () => {
  test(
    "inserts the row and returns its id",
    withCleanup((t) =>
      Effect.gen(function* () {
        const queries = yield* AppStorePaymentProviderServiceQueries;
        const personId = uniqueId("cei-person");
        const extId = uniqueId("cei-ext");
        const identifier = uniqueId("cei-identifier");
        t.persons.push(yield* insertPerson({ id: personId }));
        // Track before the write so a partial failure still cleans up.
        t.externalIdentifiers.push(extId);

        const result = yield* queries.createExternalIdentifier({
          id: extId,
          identifier,
          isDefault: true,
          personId,
          projectId,
          serviceId: "appstore",
        });
        expect(result.id).toBe(extId);

        const row = yield* findExternalIdentifierRow(extId);
        expect(row).toBeDefined();
        expect(row?.personId).toBe(personId);
        expect(row?.identifier).toBe(identifier);
        expect(row?.serviceId).toBe("appstore");
      }),
    ).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("AppStorePaymentProviderServiceQueries.rebindExternalIdentifier", () => {
  test(
    "updates the personId for an existing row",
    withCleanup((t) =>
      Effect.gen(function* () {
        const queries = yield* AppStorePaymentProviderServiceQueries;
        const oldPersonId = uniqueId("rebind-old-person");
        const newPersonId = uniqueId("rebind-new-person");
        const extId = uniqueId("rebind-ext");
        const identifier = uniqueId("rebind-identifier");
        t.persons.push(yield* insertPerson({ id: oldPersonId }));
        t.persons.push(yield* insertPerson({ id: newPersonId }));
        const db = yield* Db;
        yield* db.insert(personExternalIdentifiers).values({
          id: extId,
          identifier,
          isDefault: true,
          personId: oldPersonId,
          projectId,
          serviceId: "appstore",
        });
        t.externalIdentifiers.push(extId);

        yield* queries.rebindExternalIdentifier({ id: extId, newPersonId });

        const row = yield* findExternalIdentifierRow(extId);
        expect(row?.personId).toBe(newPersonId);
      }),
    ).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("AppStorePaymentProviderServiceQueries.findDistinctIdForPerson", () => {
  test(
    "returns Option.some with a distinctId bound to the person",
    withCleanup((t) =>
      Effect.gen(function* () {
        const queries = yield* AppStorePaymentProviderServiceQueries;
        const personId = uniqueId("fdfp-person");
        const distinctId = uniqueId("fdfp-distinct");
        t.persons.push(yield* insertPerson({ id: personId }));
        t.personIdentities.push(
          yield* insertPersonIdentity({ distinctId, id: uniqueId("fdfp-ident"), personId }),
        );

        const result = yield* queries.findDistinctIdForPerson({ personId, projectId });
        expect(Option.isSome(result)).toBe(true);
        if (Option.isSome(result)) {
          expect(result.value).toBe(distinctId);
        }
      }),
    ).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "returns Option.none when the person has no identities",
    withCleanup((t) =>
      Effect.gen(function* () {
        const queries = yield* AppStorePaymentProviderServiceQueries;
        const personId = uniqueId("fdfp-noident-person");
        t.persons.push(yield* insertPerson({ id: personId }));

        const result = yield* queries.findDistinctIdForPerson({ personId, projectId });
        expect(Option.isNone(result)).toBe(true);
      }),
    ).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("AppStorePaymentProviderServiceQueries.insertNotificationProcessedIfAbsent", () => {
  test(
    "returns inserted=true on first insert and persists the row",
    withCleanup((t) =>
      Effect.gen(function* () {
        const queries = yield* AppStorePaymentProviderServiceQueries;
        const configId = uniqueId("inpia-cfg");
        const rowId = uniqueId("inpia-row");
        const notificationUuid = uniqueId("inpia-uuid");
        t.configs.push(yield* insertProviderConfig({ id: configId }));
        t.notifications.push(rowId);

        const result = yield* queries.insertNotificationProcessedIfAbsent({
          id: rowId,
          notificationType: "TEST",
          notificationUuid,
          paymentProviderConfigurationId: configId,
          providerId: "app_store",
          result: "applied",
          source: "webhook",
        });
        expect(result.inserted).toBe(true);

        const row = yield* findNotificationRow(rowId);
        expect(row).toBeDefined();
        expect(row?.notificationUuid).toBe(notificationUuid);
        expect(row?.result).toBe("applied");
      }),
    ).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "returns inserted=false on a UNIQUE collision (duplicate notification UUID) and does not write a second row",
    withCleanup((t) =>
      Effect.gen(function* () {
        const queries = yield* AppStorePaymentProviderServiceQueries;
        const configId = uniqueId("inpia-dup-cfg");
        const firstRowId = uniqueId("inpia-dup-first");
        const secondRowId = uniqueId("inpia-dup-second");
        const notificationUuid = uniqueId("inpia-dup-uuid");
        t.configs.push(yield* insertProviderConfig({ id: configId }));
        // Both candidate ids are tracked so cleanup runs even though only the
        // first row is ever persisted.
        t.notifications.push(firstRowId);
        t.notifications.push(secondRowId);

        const first = yield* queries.insertNotificationProcessedIfAbsent({
          id: firstRowId,
          notificationType: "TEST",
          notificationUuid,
          paymentProviderConfigurationId: configId,
          providerId: "app_store",
          result: "applied",
          source: "webhook",
        });
        expect(first.inserted).toBe(true);

        // Same (configurationId, notificationUUID) → UNIQUE collision. The second
        // delivery must be reported as a duplicate, not a fresh insert.
        const second = yield* queries.insertNotificationProcessedIfAbsent({
          id: secondRowId,
          notificationType: "TEST",
          notificationUuid,
          paymentProviderConfigurationId: configId,
          providerId: "app_store",
          result: "applied",
          source: "webhook",
        });
        expect(second.inserted).toBe(false);

        // The first row survives unchanged; the second id was never persisted.
        const firstRow = yield* findNotificationRow(firstRowId);
        expect(firstRow).toBeDefined();
        const secondRow = yield* findNotificationRow(secondRowId);
        expect(secondRow).toBeUndefined();
      }),
    ).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("AppStorePaymentProviderServiceQueries.findParkedNotifications", () => {
  test(
    "returns rows parked on product mapping matching providerProductKey, omitting non-matches",
    withCleanup((t) =>
      Effect.gen(function* () {
        const queries = yield* AppStorePaymentProviderServiceQueries;
        const configId = uniqueId("fpn-cfg");
        const productKey = uniqueId("fpn-key");
        const matchId = uniqueId("fpn-match");
        const wrongKeyId = uniqueId("fpn-wrongkey");
        const wrongResultId = uniqueId("fpn-wrongresult");
        t.configs.push(yield* insertProviderConfig({ id: configId }));
        t.notifications.push(
          yield* insertNotificationRow({
            id: matchId,
            notificationUuid: uniqueId("fpn-match-uuid"),
            parkedUntilProviderProductKey: productKey,
            paymentProviderConfigurationId: configId,
            result: "parked_pending_product_mapping",
          }),
        );
        t.notifications.push(
          yield* insertNotificationRow({
            id: wrongKeyId,
            notificationUuid: uniqueId("fpn-wrongkey-uuid"),
            parkedUntilProviderProductKey: uniqueId("fpn-otherkey"),
            paymentProviderConfigurationId: configId,
            result: "parked_pending_product_mapping",
          }),
        );
        t.notifications.push(
          yield* insertNotificationRow({
            id: wrongResultId,
            notificationUuid: uniqueId("fpn-wrongresult-uuid"),
            parkedUntilProviderProductKey: productKey,
            paymentProviderConfigurationId: configId,
            result: "applied",
          }),
        );

        const rows = yield* queries.findParkedNotifications({
          paymentProviderConfigurationId: configId,
          providerProductKey: productKey,
        });
        expect(rows.some((r) => r.id === matchId)).toBe(true);
        expect(rows.some((r) => r.id === wrongKeyId)).toBe(false);
        expect(rows.some((r) => r.id === wrongResultId)).toBe(false);
      }),
    ).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "returns an empty array when there are no matches",
    Effect.gen(function* () {
      const queries = yield* AppStorePaymentProviderServiceQueries;
      const rows = yield* queries.findParkedNotifications({
        paymentProviderConfigurationId: uniqueId("fpn-empty-cfg"),
        providerProductKey: uniqueId("fpn-empty-key"),
      });
      expect(rows).toEqual([]);
    }).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("AppStorePaymentProviderServiceQueries.findParkedNotificationsByOriginalTransactionId", () => {
  test(
    "returns SDK-confirmation parked rows ordered by processedAt ASC",
    withCleanup((t) =>
      Effect.gen(function* () {
        const queries = yield* AppStorePaymentProviderServiceQueries;
        const configId = uniqueId("fpnoti-cfg");
        const originalTransactionId = uniqueId("fpnoti-otx");
        const earlierId = uniqueId("fpnoti-earlier");
        const laterId = uniqueId("fpnoti-later");
        t.configs.push(yield* insertProviderConfig({ id: configId }));
        // Insert the later row first so ordering, not insertion order, is asserted.
        t.notifications.push(
          yield* insertNotificationRow({
            id: laterId,
            notificationUuid: uniqueId("fpnoti-later-uuid"),
            parkedUntilOriginalTransactionId: originalTransactionId,
            paymentProviderConfigurationId: configId,
            processedAt: instant("2025-01-02T00:00:00Z"),
            result: "parked_pending_sdk_confirmation",
          }),
        );
        t.notifications.push(
          yield* insertNotificationRow({
            id: earlierId,
            notificationUuid: uniqueId("fpnoti-earlier-uuid"),
            parkedUntilOriginalTransactionId: originalTransactionId,
            paymentProviderConfigurationId: configId,
            processedAt: instant("2025-01-01T00:00:00Z"),
            result: "parked_pending_sdk_confirmation",
          }),
        );

        const rows = yield* queries.findParkedNotificationsByOriginalTransactionId({
          originalTransactionId,
          paymentProviderConfigurationId: configId,
        });
        const earlierIdx = rows.findIndex((r) => r.id === earlierId);
        const laterIdx = rows.findIndex((r) => r.id === laterId);
        expect(earlierIdx).toBeGreaterThanOrEqual(0);
        expect(laterIdx).toBeGreaterThanOrEqual(0);
        expect(earlierIdx).toBeLessThan(laterIdx);
      }),
    ).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("AppStorePaymentProviderServiceQueries.hasAnySubscriptionForStoreSubscriptionId", () => {
  test(
    "returns true when a subscription exists for the storeSubscriptionId",
    withCleanup((t) =>
      Effect.gen(function* () {
        const queries = yield* AppStorePaymentProviderServiceQueries;
        const personId = uniqueId("hassub-person");
        const configId = uniqueId("hassub-cfg");
        const productRowId = uniqueId("hassub-prod");
        const storeSubscriptionId = uniqueId("hassub-store");
        t.persons.push(yield* insertPerson({ id: personId }));
        t.configs.push(yield* insertProviderConfig({ id: configId }));
        t.configProducts.push(
          yield* insertProviderConfigProduct({
            id: productRowId,
            paymentProviderConfigurationId: configId,
            productId: uniqueId("hassub-pid"),
            providerProductKey: uniqueId("hassub-key"),
          }),
        );
        t.subscriptions.push(
          yield* insertSubscription({
            id: uniqueId("hassub-sub"),
            paymentProviderConfigurationProductId: productRowId,
            personId,
            storeSubscriptionId,
          }),
        );

        const result = yield* queries.hasAnySubscriptionForStoreSubscriptionId({
          storeSubscriptionId,
        });
        expect(result).toBe(true);
      }),
    ).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "returns false when no subscription matches",
    Effect.gen(function* () {
      const queries = yield* AppStorePaymentProviderServiceQueries;
      const result = yield* queries.hasAnySubscriptionForStoreSubscriptionId({
        storeSubscriptionId: uniqueId("hassub-missing"),
      });
      expect(result).toBe(false);
    }).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("AppStorePaymentProviderServiceQueries.hasAnyAppStoreRecordForOriginalTransactionId", () => {
  test(
    "returns true when a subscription matches the storeSubscriptionId",
    withCleanup((t) =>
      Effect.gen(function* () {
        const queries = yield* AppStorePaymentProviderServiceQueries;
        const personId = uniqueId("hasrec-sub-person");
        const configId = uniqueId("hasrec-sub-cfg");
        const productRowId = uniqueId("hasrec-sub-prod");
        const originalTransactionId = uniqueId("hasrec-sub-otx");
        t.persons.push(yield* insertPerson({ id: personId }));
        t.configs.push(yield* insertProviderConfig({ id: configId }));
        t.configProducts.push(
          yield* insertProviderConfigProduct({
            id: productRowId,
            paymentProviderConfigurationId: configId,
            productId: uniqueId("hasrec-sub-pid"),
            providerProductKey: uniqueId("hasrec-sub-key"),
          }),
        );
        t.subscriptions.push(
          yield* insertSubscription({
            id: uniqueId("hasrec-sub-sub"),
            paymentProviderConfigurationProductId: productRowId,
            personId,
            storeSubscriptionId: originalTransactionId,
          }),
        );

        const result = yield* queries.hasAnyAppStoreRecordForOriginalTransactionId({
          originalTransactionId,
        });
        expect(result).toBe(true);
      }),
    ).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "returns true when a transaction matches the storeTransactionId",
    withCleanup((t) =>
      Effect.gen(function* () {
        const queries = yield* AppStorePaymentProviderServiceQueries;
        const personId = uniqueId("hasrec-tx-person");
        const configId = uniqueId("hasrec-tx-cfg");
        const productRowId = uniqueId("hasrec-tx-prod");
        const originalTransactionId = uniqueId("hasrec-tx-otx");
        t.persons.push(yield* insertPerson({ id: personId }));
        t.configs.push(yield* insertProviderConfig({ id: configId }));
        t.configProducts.push(
          yield* insertProviderConfigProduct({
            id: productRowId,
            paymentProviderConfigurationId: configId,
            productId: uniqueId("hasrec-tx-pid"),
            providerProductKey: uniqueId("hasrec-tx-key"),
          }),
        );
        t.transactions.push(
          yield* insertTransaction({
            id: uniqueId("hasrec-tx-tx"),
            paymentProviderConfigurationProductId: productRowId,
            personId,
            storeTransactionId: originalTransactionId,
          }),
        );

        const result = yield* queries.hasAnyAppStoreRecordForOriginalTransactionId({
          originalTransactionId,
        });
        expect(result).toBe(true);
      }),
    ).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "returns false when neither a subscription nor a transaction matches",
    Effect.gen(function* () {
      const queries = yield* AppStorePaymentProviderServiceQueries;
      const result = yield* queries.hasAnyAppStoreRecordForOriginalTransactionId({
        originalTransactionId: uniqueId("hasrec-missing"),
      });
      expect(result).toBe(false);
    }).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("AppStorePaymentProviderServiceQueries.markParkedNotificationResolved", () => {
  test(
    "clears the parked columns, updates result/resultNote, and bumps processedAt",
    withCleanup((t) =>
      Effect.gen(function* () {
        const queries = yield* AppStorePaymentProviderServiceQueries;
        const configId = uniqueId("mpnr-cfg");
        const rowId = uniqueId("mpnr-row");
        const oldProcessedAt = instant("2024-01-01T00:00:00Z");
        t.configs.push(yield* insertProviderConfig({ id: configId }));
        t.notifications.push(
          yield* insertNotificationRow({
            id: rowId,
            notificationUuid: uniqueId("mpnr-uuid"),
            parkedRawPayload: { hello: "world" },
            parkedUntilOriginalTransactionId: uniqueId("mpnr-otx"),
            parkedUntilProviderProductKey: uniqueId("mpnr-key"),
            paymentProviderConfigurationId: configId,
            processedAt: oldProcessedAt,
            result: "parked_pending_sdk_confirmation",
          }),
        );

        yield* queries.markParkedNotificationResolved({
          id: rowId,
          result: "applied",
          resultNote: "resolved by replay",
        });

        const row = yield* findNotificationRow(rowId);
        expect(row?.result).toBe("applied");
        expect(row?.resultNote).toBe("resolved by replay");
        expect(row?.parkedRawPayload).toBeNull();
        expect(row?.parkedUntilOriginalTransactionId).toBeNull();
        expect(row?.parkedUntilProviderProductKey).toBeNull();
        // processedAt is set to NOW() — strictly newer than the seeded value.
        expect(row?.processedAt).toBeDefined();
        expect(row!.processedAt.getTime()).toBeGreaterThan(oldProcessedAt.getTime());
      }),
    ).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("AppStorePaymentProviderServiceQueries.isAppStoreWebhookStandInPerson", () => {
  test(
    "returns true when the person's origin is AppStoreWebhook",
    withCleanup((t) =>
      Effect.gen(function* () {
        const queries = yield* AppStorePaymentProviderServiceQueries;
        const personId = uniqueId("standin-yes-person");
        t.persons.push(yield* insertPerson({ id: personId, origin: PersonOrigin.AppStoreWebhook }));

        const result = yield* queries.isAppStoreWebhookStandInPerson({ personId, projectId });
        expect(result).toBe(true);
      }),
    ).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "returns false when the person's origin is not AppStoreWebhook",
    withCleanup((t) =>
      Effect.gen(function* () {
        const queries = yield* AppStorePaymentProviderServiceQueries;
        const personId = uniqueId("standin-no-person");
        t.persons.push(yield* insertPerson({ id: personId, origin: PersonOrigin.IOS }));

        const result = yield* queries.isAppStoreWebhookStandInPerson({ personId, projectId });
        expect(result).toBe(false);
      }),
    ).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "returns false when the person is not found",
    Effect.gen(function* () {
      const queries = yield* AppStorePaymentProviderServiceQueries;
      const result = yield* queries.isAppStoreWebhookStandInPerson({
        personId: uniqueId("standin-missing"),
        projectId,
      });
      expect(result).toBe(false);
    }).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("AppStorePaymentProviderServiceQueries.findSubscriptionByStoreSubscriptionId", () => {
  test(
    "returns Option.some with the subscription id when found",
    withCleanup((t) =>
      Effect.gen(function* () {
        const queries = yield* AppStorePaymentProviderServiceQueries;
        const personId = uniqueId("fsub-person");
        const configId = uniqueId("fsub-cfg");
        const productRowId = uniqueId("fsub-prod");
        const subId = uniqueId("fsub-sub");
        const storeSubscriptionId = uniqueId("fsub-store");
        t.persons.push(yield* insertPerson({ id: personId }));
        t.configs.push(yield* insertProviderConfig({ id: configId }));
        t.configProducts.push(
          yield* insertProviderConfigProduct({
            id: productRowId,
            paymentProviderConfigurationId: configId,
            productId: uniqueId("fsub-pid"),
            providerProductKey: uniqueId("fsub-key"),
          }),
        );
        t.subscriptions.push(
          yield* insertSubscription({
            id: subId,
            paymentProviderConfigurationProductId: productRowId,
            personId,
            storeSubscriptionId,
          }),
        );

        const result = yield* queries.findSubscriptionByStoreSubscriptionId({
          storeSubscriptionId,
        });
        expect(Option.isSome(result)).toBe(true);
        if (Option.isSome(result)) {
          expect(result.value.id).toBe(subId);
        }
      }),
    ).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "returns Option.none when not found",
    Effect.gen(function* () {
      const queries = yield* AppStorePaymentProviderServiceQueries;
      const result = yield* queries.findSubscriptionByStoreSubscriptionId({
        storeSubscriptionId: uniqueId("fsub-missing"),
      });
      expect(Option.isNone(result)).toBe(true);
    }).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("AppStorePaymentProviderServiceQueries.findPurchaseByProviderKey", () => {
  test(
    "returns Option.some with id and type when found",
    withCleanup((t) =>
      Effect.gen(function* () {
        const queries = yield* AppStorePaymentProviderServiceQueries;
        const personId = uniqueId("fpur-person");
        const configId = uniqueId("fpur-cfg");
        const productRowId = uniqueId("fpur-prod");
        const purchaseId = uniqueId("fpur-purchase");
        const providerKey = uniqueId("fpur-key");
        t.persons.push(yield* insertPerson({ id: personId }));
        t.configs.push(yield* insertProviderConfig({ id: configId }));
        t.configProducts.push(
          yield* insertProviderConfigProduct({
            id: productRowId,
            paymentProviderConfigurationId: configId,
            productId: uniqueId("fpur-pid"),
            providerProductKey: uniqueId("fpur-ppk"),
          }),
        );
        t.purchases.push(
          yield* insertPurchase({
            id: purchaseId,
            paymentProviderConfigurationProductId: productRowId,
            personId,
            providerKey,
            type: 1, // PurchaseType.OneTime
          }),
        );

        const result = yield* queries.findPurchaseByProviderKey({ providerKey });
        expect(Option.isSome(result)).toBe(true);
        if (Option.isSome(result)) {
          expect(result.value.id).toBe(purchaseId);
          expect(result.value.type).toBe(1);
        }
      }),
    ).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );

  test(
    "returns Option.none when not found",
    Effect.gen(function* () {
      const queries = yield* AppStorePaymentProviderServiceQueries;
      const result = yield* queries.findPurchaseByProviderKey({
        providerKey: uniqueId("fpur-missing"),
      });
      expect(Option.isNone(result)).toBe(true);
    }).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});

describe("AppStorePaymentProviderServiceQueries.expireStaleParkedSdkConfirmationRows", () => {
  test(
    "expires stale parked rows: sets result='expired', clears parked columns, and returns the count",
    withCleanup((t) =>
      Effect.gen(function* () {
        const queries = yield* AppStorePaymentProviderServiceQueries;
        const configId = uniqueId("expire-cfg");
        const staleId = uniqueId("expire-stale");
        const freshId = uniqueId("expire-fresh");
        const otherResultId = uniqueId("expire-other");
        const threshold = instant("2025-06-01T00:00:00Z");
        t.configs.push(yield* insertProviderConfig({ id: configId }));

        // Stale: parked_pending_sdk_confirmation with processedAt before threshold.
        t.notifications.push(
          yield* insertNotificationRow({
            id: staleId,
            notificationUuid: uniqueId("expire-stale-uuid"),
            parkedRawPayload: { stale: true },
            parkedUntilOriginalTransactionId: uniqueId("expire-stale-otx"),
            paymentProviderConfigurationId: configId,
            processedAt: instant("2025-01-01T00:00:00Z"),
            result: "parked_pending_sdk_confirmation",
          }),
        );
        // Fresh: parked but processedAt after threshold — must be left intact.
        t.notifications.push(
          yield* insertNotificationRow({
            id: freshId,
            notificationUuid: uniqueId("expire-fresh-uuid"),
            parkedUntilOriginalTransactionId: uniqueId("expire-fresh-otx"),
            paymentProviderConfigurationId: configId,
            processedAt: instant("2025-12-01T00:00:00Z"),
            result: "parked_pending_sdk_confirmation",
          }),
        );
        // Stale processedAt but different result — must be left intact.
        t.notifications.push(
          yield* insertNotificationRow({
            id: otherResultId,
            notificationUuid: uniqueId("expire-other-uuid"),
            paymentProviderConfigurationId: configId,
            processedAt: instant("2025-01-01T00:00:00Z"),
            result: "applied",
          }),
        );

        const result = yield* queries.expireStaleParkedSdkConfirmationRows({
          olderThan: threshold,
        });
        // At least our one stale row is expired (other concurrent rows may add to it).
        expect(result.expired).toBeGreaterThanOrEqual(1);

        const staleRow = yield* findNotificationRow(staleId);
        expect(staleRow?.result).toBe("expired");
        expect(staleRow?.resultNote).toBe("auto-expired pending SDK confirmation");
        expect(staleRow?.parkedRawPayload).toBeNull();
        expect(staleRow?.parkedUntilOriginalTransactionId).toBeNull();

        // Fresh + other-result rows untouched.
        const freshRow = yield* findNotificationRow(freshId);
        expect(freshRow?.result).toBe("parked_pending_sdk_confirmation");
        const otherRow = yield* findNotificationRow(otherResultId);
        expect(otherRow?.result).toBe("applied");
      }),
    ).pipe(
      Effect.provide(AppStorePaymentProviderServiceQueries.layer),
      CoreAuthSession.authenticate(),
    ),
  );
});
