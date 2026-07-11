/**
 * Integration tests for {@link ProductService}, run against the real backend
 * stack provisioned once by `test/_testing/globalSetup.ts` (live PlanetScale DB
 * + ClickHouse + WorkOS; only the project schema cache is an in-memory stub).
 *
 * Each test drives the service end-to-end and verifies the *persisted* side
 * effects rather than just the method's return value:
 *  - the `product` row written / updated / removed in MySQL,
 *  - the matching `audit_log` row (entity, action, actor, change snapshot),
 *  - invalidation of the project's schema cache after a successful write.
 *
 * Conventions used throughout (mirrors `PerkService.integration.test.ts`):
 *  - Every test shares the one seeded fixture project ({@link CoreTestFixture})
 *    but cleans up after itself: {@link withProductCleanup} deletes the products
 *    (and their append-only audit rows) it created on exit, success or failure.
 *    The global teardown sweep is only a backstop. Assertions stay
 *    membership-based (never exact `getProducts` counts) and slugs are unique
 *    per call so a leftover row from a crashed run can't collide.
 *  - The harness builds a fresh `ProjectSchemaCache` stub per test and shares
 *    that single instance with `SchemaCacheInvalidationService`, so seeding the
 *    cache here and reading it back after a write proves invalidation ran.
 *  - Permission tests reuse the default authenticated effect and re-authenticate
 *    just the call under test via {@link asUnauthorized}; the inner provision
 *    shadows the harness's default full-permission session.
 *  - Typed failures are asserted with `Effect.flip` (project convention),
 *    narrowing the swapped error with `instanceof` before reading its fields.
 *
 * Note on `updateProduct` slug collisions: unlike `createProduct`, the service
 * does NOT re-check slug uniqueness before updating — a collision trips the
 * `(slug, project_id)` unique index, surfacing as a `DatabaseError` that the
 * service wraps into {@link ProductServiceError}. The test asserts that tag and
 * proves the target row was left unchanged.
 */
import { Effect } from "effect";
import { describe, expect } from "vitest";

import { ProductService, ProjectSchemaCache } from "@voidhash/core/services";
import { ProductServiceError } from "@voidhash/core/services/products/ProductService";
import { ActionForbiddenError, type UserSession } from "@voidhash/core/domain/auth/Auth";
import {
  ProductNotFoundError,
  ProductSlugAlreadyExistsError,
} from "@voidhash/core/domain/product/Product";
import {
  AuditLogAction,
  AuditLogActorType,
  AuditLogEntityType,
  Db,
  and,
  auditLogs,
  eq,
  inArray,
  products,
} from "@voidhash/db";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;

/** Monotonic counter so slugs stay unique even within the same millisecond. */
let slugSeq = 0;
const uniqueSlug = (label: string) => `it-product-${label}-${Date.now()}-${slugSeq++}`;

/** Read a product row straight from the database, bypassing the service. */
const findProductRow = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db.query.products.findFirst({ where: { id } });
  });

/** Count product rows with a given slug in the fixture project. */
const countProductsWithSlug = (slug: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const rows = yield* db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.projectId, projectId), eq(products.slug, slug)));
    return rows.length;
  });

/** All audit-log rows recorded for a given product entity. */
const findProductAuditEntries = (entityId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    return yield* db
      .select()
      .from(auditLogs)
      .where(
        and(eq(auditLogs.entityType, AuditLogEntityType.Product), eq(auditLogs.entityId, entityId)),
      );
  });

/**
 * Delete the given products and their audit rows. Audit entries are append-only
 * and survive a `deleteProduct`, so they are cleared by entity id too. Each
 * delete is `ignore`d so a missing row never turns the finalizer into a failure.
 */
const cleanupCreatedProducts = (ids: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    if (ids.length === 0) return;
    const db = yield* Db;
    const targets = [...ids];
    yield* db
      .delete(auditLogs)
      .where(
        and(
          eq(auditLogs.entityType, AuditLogEntityType.Product),
          inArray(auditLogs.entityId, targets),
        ),
      )
      .pipe(Effect.ignore);
    yield* db.delete(products).where(inArray(products.id, targets)).pipe(Effect.ignore);
  });

/**
 * Wrap a test body so every product it creates is removed afterward, regardless
 * of how the test exits. Pass each created product id to the `track` callback;
 * cleanup reads the collected ids lazily at finalization via `Effect.ensuring`,
 * so it sees every id tracked while the body ran (including on failure).
 */
const withProductCleanup = <E, R>(
  body: (track: (id: string) => void) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const createdIds: string[] = [];
  return body((id) => {
    createdIds.push(id);
  }).pipe(Effect.ensuring(cleanupCreatedProducts(createdIds)));
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
 * Run a single call as a caller with no project access. Re-authenticates just
 * this effect with the no-access session; the inner provision shadows the
 * harness's default full-permission session for the wrapped call only.
 */
const asUnauthorized = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(CoreAuthSession.authenticate(sessionWithoutProjectAccess()));

describe("ProductService.createProduct", () => {
  test(
    "persists the product, records a created audit entry, and invalidates the schema cache",
    withProductCleanup((track) =>
      Effect.gen(function* () {
        const productService = yield* ProductService;
        const cache = yield* ProjectSchemaCache;

        const name = "Integration Product";
        const slug = uniqueSlug("create");

        // Seed the cache so a successful invalidation is observable, not vacuously null.
        yield* cache.getByName(projectId).set({ marker: "present" }, 60_000);

        const created = yield* productService.createProduct({ name, projectId, slug });
        track(created.id);
        expect(created.id.startsWith("prod_")).toBe(true);

        const row = yield* findProductRow(created.id);
        expect(row).toBeDefined();
        expect(row?.name).toBe(name);
        expect(row?.slug).toBe(slug);
        expect(row?.projectId).toBe(projectId);

        const auditEntries = yield* findProductAuditEntries(created.id);
        const createdEntry = auditEntries.find((entry) => entry.action === AuditLogAction.Created);
        expect(createdEntry).toBeDefined();
        expect(createdEntry?.entityType).toBe(AuditLogEntityType.Product);
        expect(createdEntry?.actorUserId).toBe(CoreTestFixture.userId);
        expect(createdEntry?.actorType).toBe(AuditLogActorType.User);
        expect(createdEntry?.changes).toEqual({ snapshot: { name, slug } });

        const cached = yield* cache.getByName(projectId).get();
        expect(cached).toBeNull();
      }),
    ).pipe(Effect.provide(ProductService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "rejects a duplicate slug within the project and writes no second row",
    withProductCleanup((track) =>
      Effect.gen(function* () {
        const productService = yield* ProductService;
        const slug = uniqueSlug("duplicate");

        const first = yield* productService.createProduct({ name: "First", projectId, slug });
        track(first.id);

        const error = yield* Effect.flip(
          productService.createProduct({ name: "Second", projectId, slug }),
        );
        expect(error).toBeInstanceOf(ProductSlugAlreadyExistsError);
        if (error instanceof ProductSlugAlreadyExistsError) {
          expect(error.slug).toBe(slug);
        }

        // The slug-recheck inside `db.transaction` closed the race: only one row.
        expect(yield* countProductsWithSlug(slug)).toBe(1);
      }),
    ).pipe(Effect.provide(ProductService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all and writes nothing",
    // No cleanup wrapper: a forbidden create writes no row.
    Effect.gen(function* () {
      const productService = yield* ProductService;
      const slug = uniqueSlug("forbidden");

      const error = yield* Effect.flip(
        asUnauthorized(productService.createProduct({ name: "Nope", projectId, slug })),
      );
      expect(error).toBeInstanceOf(ActionForbiddenError);

      expect(yield* countProductsWithSlug(slug)).toBe(0);
    }).pipe(Effect.provide(ProductService.layer), CoreAuthSession.authenticate()),
  );
});

describe("ProductService.getProducts", () => {
  test(
    "returns products created under the project",
    withProductCleanup((track) =>
      Effect.gen(function* () {
        const productService = yield* ProductService;
        const slugA = uniqueSlug("list-a");
        const slugB = uniqueSlug("list-b");
        const absentSlug = uniqueSlug("list-absent");

        const a = yield* productService.createProduct({ name: "A", projectId, slug: slugA });
        track(a.id);
        const b = yield* productService.createProduct({ name: "B", projectId, slug: slugB });
        track(b.id);

        const list = yield* productService.getProducts(projectId);
        // Created products default to the `subscription` type in the schema.
        expect(
          list.some(
            (product) =>
              product.id === a.id && product.slug === slugA && product.type === "subscription",
          ),
        ).toBe(true);
        expect(list.some((product) => product.id === b.id && product.slug === slugB)).toBe(true);
        expect(list.some((product) => product.slug === absentSlug)).toBe(false);
      }),
    ).pipe(Effect.provide(ProductService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all",
    Effect.gen(function* () {
      const productService = yield* ProductService;
      const error = yield* Effect.flip(asUnauthorized(productService.getProducts(projectId)));
      expect(error).toBeInstanceOf(ActionForbiddenError);
    }).pipe(Effect.provide(ProductService.layer), CoreAuthSession.authenticate()),
  );
});

describe("ProductService.getProductById", () => {
  test(
    "returns the matching product",
    withProductCleanup((track) =>
      Effect.gen(function* () {
        const productService = yield* ProductService;
        const slug = uniqueSlug("by-id");
        const created = yield* productService.createProduct({ name: "Lookup", projectId, slug });
        track(created.id);

        const product = yield* productService.getProductById(created.id);
        expect(product.id).toBe(created.id);
        expect(product.name).toBe("Lookup");
        expect(product.slug).toBe(slug);
        expect(product.projectId).toBe(projectId);
        expect(product.type).toBe("subscription");
      }),
    ).pipe(Effect.provide(ProductService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with ProductNotFoundError for an unknown id",
    Effect.gen(function* () {
      const productService = yield* ProductService;
      const error = yield* Effect.flip(
        productService.getProductById(`product_missing_${Date.now()}`),
      );
      expect(error).toBeInstanceOf(ProductNotFoundError);
    }).pipe(Effect.provide(ProductService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids access to a product the caller is not authorized for",
    withProductCleanup((track) =>
      Effect.gen(function* () {
        const productService = yield* ProductService;
        const slug = uniqueSlug("by-id-forbidden");
        const created = yield* productService.createProduct({ name: "Guarded", projectId, slug });
        track(created.id);

        const error = yield* Effect.flip(asUnauthorized(productService.getProductById(created.id)));
        expect(error).toBeInstanceOf(ActionForbiddenError);
      }),
    ).pipe(Effect.provide(ProductService.layer), CoreAuthSession.authenticate()),
  );
});

describe("ProductService.updateProduct", () => {
  test(
    "changes name and slug, records an updated audit entry, and invalidates the schema cache",
    withProductCleanup((track) =>
      Effect.gen(function* () {
        const productService = yield* ProductService;
        const cache = yield* ProjectSchemaCache;

        const created = yield* productService.createProduct({
          name: "Before",
          projectId,
          slug: uniqueSlug("update-before"),
        });
        track(created.id);

        const newName = "After";
        const newSlug = uniqueSlug("update-after");
        yield* cache.getByName(projectId).set({ marker: "present" }, 60_000);

        yield* productService.updateProduct({ id: created.id, name: newName, slug: newSlug });

        const row = yield* findProductRow(created.id);
        expect(row?.name).toBe(newName);
        expect(row?.slug).toBe(newSlug);

        const auditEntries = yield* findProductAuditEntries(created.id);
        const updatedEntry = auditEntries.find((entry) => entry.action === AuditLogAction.Updated);
        expect(updatedEntry).toBeDefined();
        expect(updatedEntry?.changes).toEqual({ snapshot: { name: newName, slug: newSlug } });

        const cached = yield* cache.getByName(projectId).get();
        expect(cached).toBeNull();
      }),
    ).pipe(Effect.provide(ProductService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "updates only the name when no slug is provided, leaving the slug intact",
    withProductCleanup((track) =>
      Effect.gen(function* () {
        const productService = yield* ProductService;
        const slug = uniqueSlug("update-name-only");
        const created = yield* productService.createProduct({ name: "Keep", projectId, slug });
        track(created.id);

        yield* productService.updateProduct({ id: created.id, name: "Keep Renamed" });

        const row = yield* findProductRow(created.id);
        expect(row?.name).toBe("Keep Renamed");
        // The optional slug was omitted, so the original slug must survive.
        expect(row?.slug).toBe(slug);
      }),
    ).pipe(Effect.provide(ProductService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "rejects a slug already used by another product and leaves the target unchanged",
    withProductCleanup((track) =>
      Effect.gen(function* () {
        const productService = yield* ProductService;
        const slugA = uniqueSlug("update-collide-a");
        const slugB = uniqueSlug("update-collide-b");

        const a = yield* productService.createProduct({ name: "A", projectId, slug: slugA });
        track(a.id);
        const b = yield* productService.createProduct({ name: "B", projectId, slug: slugB });
        track(b.id);

        // `updateProduct` does not pre-check slug uniqueness; the `(slug,
        // project_id)` unique index rejects the collision and the service wraps
        // the resulting DatabaseError as ProductServiceError.
        const error = yield* Effect.flip(
          productService.updateProduct({ id: b.id, name: "B", slug: slugA }),
        );
        expect(error).toBeInstanceOf(ProductServiceError);

        // The failed update must not have mutated row B.
        const row = yield* findProductRow(b.id);
        expect(row?.slug).toBe(slugB);
        expect(row?.name).toBe("B");
      }),
    ).pipe(Effect.provide(ProductService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with ProductNotFoundError for an unknown id",
    Effect.gen(function* () {
      const productService = yield* ProductService;
      const error = yield* Effect.flip(
        productService.updateProduct({ id: `product_missing_${Date.now()}`, name: "Ghost" }),
      );
      expect(error).toBeInstanceOf(ProductNotFoundError);
    }).pipe(Effect.provide(ProductService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all and leaves the product unchanged",
    withProductCleanup((track) =>
      Effect.gen(function* () {
        const productService = yield* ProductService;
        const slug = uniqueSlug("update-forbidden");
        const created = yield* productService.createProduct({ name: "Protected", projectId, slug });
        track(created.id);

        const error = yield* Effect.flip(
          asUnauthorized(productService.updateProduct({ id: created.id, name: "Hacked", slug })),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);

        const row = yield* findProductRow(created.id);
        expect(row?.name).toBe("Protected");
        expect(row?.slug).toBe(slug);
      }),
    ).pipe(Effect.provide(ProductService.layer), CoreAuthSession.authenticate()),
  );
});

describe("ProductService.deleteProduct", () => {
  test(
    "removes the product, records a deleted audit entry, and invalidates the schema cache",
    withProductCleanup((track) =>
      Effect.gen(function* () {
        const productService = yield* ProductService;
        const cache = yield* ProjectSchemaCache;

        const created = yield* productService.createProduct({
          name: "Doomed",
          projectId,
          slug: uniqueSlug("delete"),
        });
        track(created.id);
        yield* cache.getByName(projectId).set({ marker: "present" }, 60_000);

        yield* productService.deleteProduct({ id: created.id });

        const row = yield* findProductRow(created.id);
        expect(row).toBeUndefined();

        const lookup = yield* Effect.flip(productService.getProductById(created.id));
        expect(lookup).toBeInstanceOf(ProductNotFoundError);

        const auditEntries = yield* findProductAuditEntries(created.id);
        const deletedEntry = auditEntries.find((entry) => entry.action === AuditLogAction.Deleted);
        expect(deletedEntry).toBeDefined();
        expect(deletedEntry?.actorUserId).toBe(CoreTestFixture.userId);
        expect(deletedEntry?.actorType).toBe(AuditLogActorType.User);

        const cached = yield* cache.getByName(projectId).get();
        expect(cached).toBeNull();
      }),
    ).pipe(Effect.provide(ProductService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "fails with ProductNotFoundError for an unknown id",
    Effect.gen(function* () {
      const productService = yield* ProductService;
      const error = yield* Effect.flip(
        productService.deleteProduct({ id: `product_missing_${Date.now()}` }),
      );
      expect(error).toBeInstanceOf(ProductNotFoundError);
    }).pipe(Effect.provide(ProductService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all and retains the product",
    withProductCleanup((track) =>
      Effect.gen(function* () {
        const productService = yield* ProductService;
        const created = yield* productService.createProduct({
          name: "Protected",
          projectId,
          slug: uniqueSlug("delete-forbidden"),
        });
        track(created.id);

        const error = yield* Effect.flip(
          asUnauthorized(productService.deleteProduct({ id: created.id })),
        );
        expect(error).toBeInstanceOf(ActionForbiddenError);

        const row = yield* findProductRow(created.id);
        expect(row).toBeDefined();
      }),
    ).pipe(Effect.provide(ProductService.layer), CoreAuthSession.authenticate()),
  );
});
