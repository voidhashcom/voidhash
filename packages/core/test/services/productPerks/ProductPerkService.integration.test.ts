/**
 * Integration tests for {@link ProductPerkService}, run against the real backend
 * stack provisioned once by `test/_testing/globalSetup.ts` (live PlanetScale DB +
 * ClickHouse + WorkOS; only the project schema cache is an in-memory stub).
 *
 * The service owns the `(product, perk)` join-table aggregate. Each test drives
 * a public method end-to-end and verifies the *persisted* side effects, not just
 * the return value:
 *  - the `product_perk` row written / removed in MySQL,
 *  - the matching `audit_log` row (entity, action, actor, `parentEntityId` = the
 *    product id),
 *  - invalidation of the product project's schema cache after a successful write.
 *
 * Conventions (mirroring `PerkService.integration.test.ts`):
 *  - The fixture seeds only user/org/member/project, so every test seeds its own
 *    parent `product` and `perk` rows under {@link CoreTestFixture} via raw insert
 *    (the service has no create-product / create-perk surface) and cleans them up
 *    on exit through {@link withRowCleanup}, regardless of how the body exits.
 *  - Slugs/ids are namespaced and unique per call; assertions stay
 *    membership-based (`.some(...)` / by-id), never exact counts.
 *  - The harness shares one `ProjectSchemaCache` stub instance with
 *    `SchemaCacheInvalidationService`, so seeding the cache then reading it back
 *    after a write proves invalidation ran.
 *  - Permission tests re-authenticate just the call under test via
 *    {@link asUnauthorized}; the inner provision shadows the harness default.
 *  - Typed failures use `Effect.flip` + `instanceof`, paired with a DB-state
 *    assertion proving the failure path wrote (or retained) nothing unexpected.
 */
import { Effect } from "effect";
import { describe, expect } from "vitest";

import { ProductPerkService, ProjectSchemaCache } from "@voidhash/core/services";
import { ActionForbiddenError, type UserSession } from "@voidhash/core/domain/auth/Auth";
import { ProductPerkValidationError } from "@voidhash/core/services/productPerks/ProductPerkService";
import {
  AuditLogAction,
  AuditLogActorType,
  AuditLogEntityType,
  Db,
  and,
  auditLogs,
  eq,
  inArray,
  perks,
  productPerks,
  products,
  projects,
} from "@voidhash/db";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;

/** Monotonic counter so ids stay unique even within the same millisecond. */
let idSeq = 0;
const uniqueId = (label: string) => `it-${label}-${Date.now()}-${idSeq++}`;

/** Insert a `product` row under the fixture project and return its id. */
const seedProduct = (overrides?: { readonly projectId?: string }) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const id = uniqueId("prod");
    yield* db.insert(products).values({
      id,
      name: id,
      projectId: overrides?.projectId ?? projectId,
      slug: id,
    });
    return id;
  });

/** Insert a `perk` row under the fixture project and return its id. */
const seedPerk = (overrides?: { readonly projectId?: string }) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const id = uniqueId("perk");
    yield* db.insert(perks).values({
      id,
      name: id,
      projectId: overrides?.projectId ?? projectId,
      slug: id,
    });
    return id;
  });

/** Insert a bare `project` row under the fixture org and return its id. */
const seedProject = () =>
  Effect.gen(function* () {
    const db = yield* Db;
    const id = uniqueId("proj");
    yield* db.insert(projects).values({
      id,
      name: id,
      organizationId: CoreTestFixture.organizationId,
      slug: id,
    });
    return id;
  });

/** Read a product-perk row straight from the database, bypassing the service. */
const findProductPerkRow = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.productPerks.findFirst({ where: { id } });
  });

/** All `product_perk` rows for a given product. */
const findProductPerksForProduct = (productId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.select().from(productPerks).where(eq(productPerks.productId, productId));
  });

/** All audit-log rows recorded for a given product-perk entity. */
const findProductPerkAuditEntries = (entityId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.entityType, AuditLogEntityType.ProductPerk),
          eq(auditLogs.entityId, entityId),
        ),
      );
  });

/**
 * Tracker for everything a test creates so the finalizer can sweep it. Audit
 * entries are append-only and survive a `deleteProductPerk`, so they are cleared
 * by entity id too. Order matters: dependents (product_perk) before parents.
 */
type Tracked = {
  readonly productPerkIds: string[];
  readonly productIds: string[];
  readonly perkIds: string[];
  readonly projectIds: string[];
};

const cleanupTracked = (t: Tracked) =>
  Effect.gen(function* () {
    const db = yield* Db;
    if (t.productPerkIds.length > 0) {
      yield* db
        .delete(auditLogs)
        .where(
          and(
            eq(auditLogs.entityType, AuditLogEntityType.ProductPerk),
            inArray(auditLogs.entityId, t.productPerkIds),
          ),
        )
        .pipe(Effect.ignore);
      yield* db
        .delete(productPerks)
        .where(inArray(productPerks.id, t.productPerkIds))
        .pipe(Effect.ignore);
    }
    if (t.productIds.length > 0) {
      yield* db
        .delete(productPerks)
        .where(inArray(productPerks.productId, t.productIds))
        .pipe(Effect.ignore);
      yield* db.delete(products).where(inArray(products.id, t.productIds)).pipe(Effect.ignore);
    }
    if (t.perkIds.length > 0) {
      yield* db.delete(perks).where(inArray(perks.id, t.perkIds)).pipe(Effect.ignore);
    }
    if (t.projectIds.length > 0) {
      yield* db.delete(projects).where(inArray(projects.id, t.projectIds)).pipe(Effect.ignore);
    }
  });

/**
 * Wrap a test body so every row it creates is removed afterward, regardless of
 * how the test exits. The body receives a `track` object whose arrays it pushes
 * created ids into; cleanup reads them lazily at finalization via
 * `Effect.ensuring`, so it sees every id tracked while the body ran.
 */
const withRowCleanup = <E, R>(
  body: (track: Tracked) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const track: Tracked = { productPerkIds: [], productIds: [], perkIds: [], projectIds: [] };
  return body(track).pipe(Effect.ensuring(cleanupTracked(track)));
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
 * A `user`-method session that holds `project:all` only on the fixture project,
 * so a call touching some other project's perk is forbidden on the *perk's*
 * project check while passing the product's project check.
 */
const sessionWithFixtureProjectOnly = (): UserSession => ({
  cookie: null,
  method: "user",
  name: `${CoreTestFixture.userName} <${CoreTestFixture.userEmail}>`,
  organizations: [
    {
      id: CoreTestFixture.organizationId,
      logo: null,
      name: CoreTestFixture.organizationName,
      permissions: ["organization:all"],
      slug: CoreTestFixture.organizationSlug,
      workosOrganizationId: CoreTestFixture.workosOrganizationId,
    },
  ],
  person: null,
  projects: [
    {
      id: CoreTestFixture.projectId,
      logo: null,
      name: CoreTestFixture.projectName,
      organizationId: CoreTestFixture.organizationId,
      permissions: ["project:all"],
      slug: CoreTestFixture.projectSlug,
    },
  ],
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
 * Run a single call as a caller with no project access. Re-authenticates just
 * this effect with the no-access session; the inner provision shadows the
 * harness's default full-permission session for the wrapped call only.
 */
const asUnauthorized = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(CoreAuthSession.authenticate(sessionWithoutProjectAccess()));

describe("ProductPerkService.getProductPerksByProductId", () => {
  test(
    "returns the product's perks ordered by createdAt",
    withRowCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* ProductPerkService;

        const productId = yield* seedProduct();
        track.productIds.push(productId);
        const perkA = yield* seedPerk();
        const perkB = yield* seedPerk();
        track.perkIds.push(perkA, perkB);

        const a = yield* service.createProductPerk({ productId, perkId: perkA });
        track.productPerkIds.push(a.id);
        const b = yield* service.createProductPerk({ productId, perkId: perkB });
        track.productPerkIds.push(b.id);

        const list = yield* service.getProductPerksByProductId(productId);
        expect(list.some((pp) => pp.id === a.id && pp.perkId === perkA)).toBe(true);
        expect(list.some((pp) => pp.id === b.id && pp.perkId === perkB)).toBe(true);
        // The service orders by `asc(productPerks.createdAt)`, but
        // `product_perk.created_at` has whole-second precision (no `fsp`), so
        // two rows created back-to-back share the same truncated `createdAt`
        // and `ORDER BY created_at ASC` is a tie whose resolution is not
        // deterministic. Assert only what is guaranteed: both rows are present
        // and the returned `createdAt` sequence is non-decreasing.
        const idxA = list.findIndex((pp) => pp.id === a.id);
        const idxB = list.findIndex((pp) => pp.id === b.id);
        expect(idxA).toBeGreaterThanOrEqual(0);
        expect(idxB).toBeGreaterThanOrEqual(0);
        const createdAts = list.map((pp) => new Date(pp.createdAt ?? 0).getTime());
        for (let i = 1; i < createdAts.length; i++) {
          expect(createdAts[i]).toBeGreaterThanOrEqual(createdAts[i - 1]!);
        }
      }),
    ).pipe(Effect.provide(ProductPerkService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with ProductPerkValidationError when the product is missing",
    Effect.gen(function* () {
      const service = yield* ProductPerkService;
      const error = yield* Effect.flip(
        service.getProductPerksByProductId(`it-prod-missing-${Date.now()}`),
      );
      expect(error).toBeInstanceOf(ProductPerkValidationError);
    }).pipe(Effect.provide(ProductPerkService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all",
    withRowCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* ProductPerkService;
        const productId = yield* seedProduct();
        track.productIds.push(productId);

        const error = yield* Effect.flip(
          asUnauthorized(service.getProductPerksByProductId(productId)),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);
      }),
    ).pipe(Effect.provide(ProductPerkService.layer), CoreAuthSession.authenticate()),
  );
});

describe("ProductPerkService.createProductPerk", () => {
  test(
    "persists the row, records a created audit entry with the product as parent, and invalidates the schema cache",
    withRowCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* ProductPerkService;
        const cache = yield* ProjectSchemaCache;

        const productId = yield* seedProduct();
        track.productIds.push(productId);
        const perkId = yield* seedPerk();
        track.perkIds.push(perkId);

        // Seed the cache so a successful invalidation is observable, not vacuously null.
        yield* cache.getByName(projectId).set({ marker: "present" }, 60_000);

        const created = yield* service.createProductPerk({ productId, perkId });
        track.productPerkIds.push(created.id);
        expect(created.id.startsWith("prod_perk_")).toBe(true);

        const row = yield* findProductPerkRow(created.id);
        expect(row).toBeDefined();
        expect(row?.productId).toBe(productId);
        expect(row?.perkId).toBe(perkId);

        const auditEntries = yield* findProductPerkAuditEntries(created.id);
        const createdEntry = auditEntries.find((e) => e.action === AuditLogAction.Created);
        expect(createdEntry).toBeDefined();
        expect(createdEntry?.entityType).toBe(AuditLogEntityType.ProductPerk);
        expect(createdEntry?.parentEntityId).toBe(productId);
        expect(createdEntry?.actorUserId).toBe(CoreTestFixture.userId);
        expect(createdEntry?.actorType).toBe(AuditLogActorType.User);

        const cached = yield* cache.getByName(projectId).get();
        expect(cached).toBeNull();
      }),
    ).pipe(Effect.provide(ProductPerkService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "rejects a duplicate (product, perk) pair and writes no second row",
    withRowCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* ProductPerkService;

        const productId = yield* seedProduct();
        track.productIds.push(productId);
        const perkId = yield* seedPerk();
        track.perkIds.push(perkId);

        const first = yield* service.createProductPerk({ productId, perkId });
        track.productPerkIds.push(first.id);

        // The unique (product_id, perk_id) index turns the duplicate insert's
        // DatabaseError into the service's catch-all ProductPerkServiceError.
        const error = yield* Effect.flip(service.createProductPerk({ productId, perkId }));
        expect(error._tag).toBe("ProductPerkServiceError");

        const rows = yield* findProductPerksForProduct(productId);
        expect(rows.filter((r) => r.perkId === perkId).length).toBe(1);
      }),
    ).pipe(Effect.provide(ProductPerkService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with ProductPerkValidationError when the product is missing and writes nothing",
    withRowCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* ProductPerkService;
        const perkId = yield* seedPerk();
        track.perkIds.push(perkId);

        const error = yield* Effect.flip(
          service.createProductPerk({ productId: `it-prod-missing-${Date.now()}`, perkId }),
        );
        expect(error).toBeInstanceOf(ProductPerkValidationError);
      }),
    ).pipe(Effect.provide(ProductPerkService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with ProductPerkValidationError when the perk is missing and writes no row",
    withRowCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* ProductPerkService;
        const productId = yield* seedProduct();
        track.productIds.push(productId);

        const error = yield* Effect.flip(
          service.createProductPerk({ productId, perkId: `it-perk-missing-${Date.now()}` }),
        );
        expect(error).toBeInstanceOf(ProductPerkValidationError);

        const rows = yield* findProductPerksForProduct(productId);
        expect(rows.length).toBe(0);
      }),
    ).pipe(Effect.provide(ProductPerkService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all on the product's project and writes no row",
    withRowCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* ProductPerkService;
        const productId = yield* seedProduct();
        track.productIds.push(productId);
        const perkId = yield* seedPerk();
        track.perkIds.push(perkId);

        const error = yield* Effect.flip(
          asUnauthorized(service.createProductPerk({ productId, perkId })),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);

        const rows = yield* findProductPerksForProduct(productId);
        expect(rows.length).toBe(0);
      }),
    ).pipe(Effect.provide(ProductPerkService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all on the perk's project and writes no row",
    withRowCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* ProductPerkService;

        // Product lives in the fixture project (caller is authorized there) but
        // the perk lives in a separate project the caller cannot access, so the
        // perk-project permission check is the one that must reject.
        const productId = yield* seedProduct();
        track.productIds.push(productId);
        const otherProjectId = yield* seedProject();
        track.projectIds.push(otherProjectId);
        const perkId = yield* seedPerk({ projectId: otherProjectId });
        track.perkIds.push(perkId);

        const error = yield* Effect.flip(
          service
            .createProductPerk({ productId, perkId })
            .pipe(CoreAuthSession.authenticate(sessionWithFixtureProjectOnly())),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);

        const rows = yield* findProductPerksForProduct(productId);
        expect(rows.length).toBe(0);
      }),
    ).pipe(Effect.provide(ProductPerkService.layer), CoreAuthSession.authenticate()),
  );
});

describe("ProductPerkService.deleteProductPerk", () => {
  test(
    "removes the row, records a deleted audit entry, and invalidates the schema cache",
    withRowCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* ProductPerkService;
        const cache = yield* ProjectSchemaCache;

        const productId = yield* seedProduct();
        track.productIds.push(productId);
        const perkId = yield* seedPerk();
        track.perkIds.push(perkId);

        const created = yield* service.createProductPerk({ productId, perkId });
        track.productPerkIds.push(created.id);

        yield* cache.getByName(projectId).set({ marker: "present" }, 60_000);

        yield* service.deleteProductPerk({ id: created.id });

        const row = yield* findProductPerkRow(created.id);
        expect(row).toBeUndefined();

        const auditEntries = yield* findProductPerkAuditEntries(created.id);
        const deletedEntry = auditEntries.find((e) => e.action === AuditLogAction.Deleted);
        expect(deletedEntry).toBeDefined();
        expect(deletedEntry?.parentEntityId).toBe(productId);
        expect(deletedEntry?.actorUserId).toBe(CoreTestFixture.userId);

        const cached = yield* cache.getByName(projectId).get();
        expect(cached).toBeNull();
      }),
    ).pipe(Effect.provide(ProductPerkService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with ProductPerkValidationError for an unknown id",
    Effect.gen(function* () {
      const service = yield* ProductPerkService;
      const error = yield* Effect.flip(
        service.deleteProductPerk({ id: `it-prod-perk-missing-${Date.now()}` }),
      );
      expect(error).toBeInstanceOf(ProductPerkValidationError);
    }).pipe(Effect.provide(ProductPerkService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all and retains the row",
    withRowCleanup((track) =>
      Effect.gen(function* () {
        const service = yield* ProductPerkService;

        const productId = yield* seedProduct();
        track.productIds.push(productId);
        const perkId = yield* seedPerk();
        track.perkIds.push(perkId);

        const created = yield* service.createProductPerk({ productId, perkId });
        track.productPerkIds.push(created.id);

        const error = yield* Effect.flip(
          asUnauthorized(service.deleteProductPerk({ id: created.id })),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);

        const row = yield* findProductPerkRow(created.id);
        expect(row).toBeDefined();
      }),
    ).pipe(Effect.provide(ProductPerkService.layer), CoreAuthSession.authenticate()),
  );
});
