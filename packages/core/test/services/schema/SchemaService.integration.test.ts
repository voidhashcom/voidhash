/**
 * Integration tests for {@link SchemaService}, run against the real backend
 * stack provisioned once by `test/_testing/globalSetup.ts` (live PlanetScale DB
 * + ClickHouse + WorkOS; only the project schema cache is the in-memory stub the
 * harness builds fresh per test).
 *
 * `SchemaService` is a read-only assembler: it folds six concurrent
 * project-scoped queries (perks, products, active paywall locations, product↔perk
 * links, active per-product provider mappings, enabled providers) into one
 * immutable {@link ProjectSchema} and caches it behind {@link ProjectSchemaCache}.
 * The tests therefore verify the *assembled projection* and the *cache side
 * effect*, not just a return value:
 *  - the schema reflects rows seeded directly in MySQL (membership by slug),
 *  - archived locations, soft-deleted provider configurations, and providers the
 *    contract doesn't surface (e.g. `"stripe"`) are filtered out,
 *  - the deterministic `sha256:` version hash matches the byte layout the CLI's
 *    `computeSchemaVersionFromNormalized` reproduces,
 *  - a cache hit short-circuits assembly and a cache miss populates the cache,
 *  - `getProjectSchema` enforces `project:all` while the SDK variant does not.
 *
 * Conventions:
 *  - The service has no mutating API, so test rows are seeded with raw inserts
 *    (one fresh, uniquely-slugged set per test) under the shared fixture project
 *    ({@link CoreTestFixture}) and removed on exit via {@link withCleanup},
 *    regardless of how the test ends. The global teardown sweep is only a
 *    backstop. Assertions stay membership-based (`.some(...)` / by-slug) — never
 *    exact counts — so leftovers from a crashed run can't collide.
 *  - Permission tests reuse the default authenticated effect and re-authenticate
 *    just the call under test via {@link asUnauthorized}; the inner provision
 *    shadows the harness's default full-permission session for that call only.
 *  - Typed failures are asserted with `Effect.flip` (project convention),
 *    narrowing the swapped error with `instanceof`.
 */
import { Clock, DateTime, Effect, Schema } from "effect";
import { ProductType, type ProductTypeValue } from "@voidhash/lib";
import { constant } from "@voidhash/lib/lang";
import { subtle } from "uncrypto";
import { describe, expect, test as vitestTest } from "vitest";

import { SchemaService, ProjectSchemaCache } from "@voidhash/core/services";
import { ActionForbiddenError, type UserSession } from "@voidhash/core/domain/auth/Auth";
import { generateId } from "@voidhash/core/utils/generate-id";
import {
  Db,
  inArray,
  paymentProviderConfigurationProducts,
  paymentProviderConfigurations,
  paywallLocations,
  perks,
  productPerks,
  products,
} from "@voidhash/db";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const projectId = CoreTestFixture.projectId;

/** Monotonic counter so slugs stay unique even within the same millisecond. */
let slugSeq = 0;
const uniqueSlug = (label: string): Effect.Effect<string> =>
  Effect.map(Clock.currentTimeMillis, (nowMillis) => `it-schema-${label}-${nowMillis}-${slugSeq++}`);

/** `Date` at `millis` since the epoch — the `new Date(millis)` seam. */
const dateAtMillis = (millis: number): Date => DateTime.toDateUtc(DateTime.makeUnsafe(millis));

/** The cached schema envelope, decoded rather than asserted. */
const CachedSchema = Schema.Struct({ version: Schema.String });
const cachedVersion = (cached: unknown): string =>
  Schema.decodeUnknownSync(CachedSchema)(cached).version;

/** The `JSON.stringify` seam, byte-identical to `computeSchemaVersion`. */
const encodeJsonValue = Schema.encodeSync(Schema.UnknownFromJsonString);

/**
 * Tracks every row a test seeds across the five catalog tables so the cleanup
 * finalizer can remove them on any exit. Deletes deepest FK dependents first.
 */
interface Tracker {
  readonly product: (id: string) => void;
  readonly perk: (id: string) => void;
  readonly location: (id: string) => void;
  readonly productPerk: (id: string) => void;
  readonly providerConfig: (id: string) => void;
  readonly providerConfigProduct: (id: string) => void;
}

interface CreatedRows {
  products: string[];
  perks: string[];
  locations: string[];
  productPerks: string[];
  providerConfigs: string[];
  providerConfigProducts: string[];
}

/**
 * Delete the rows a test seeded, deepest dependents first. Each delete is
 * `ignore`d so a missing row never turns the finalizer into a failure. None of
 * these tables hold audit rows for this read-only service, so no audit cleanup
 * is needed.
 */
const cleanupCreatedRows = (rows: CreatedRows) =>
  Effect.gen(function* () {
    const db = yield* Db;
    if (rows.providerConfigProducts.length > 0) {
      yield* db
        .delete(paymentProviderConfigurationProducts)
        .where(inArray(paymentProviderConfigurationProducts.id, rows.providerConfigProducts))
        .pipe(Effect.ignore);
    }
    if (rows.productPerks.length > 0) {
      yield* db
        .delete(productPerks)
        .where(inArray(productPerks.id, rows.productPerks))
        .pipe(Effect.ignore);
    }
    if (rows.providerConfigs.length > 0) {
      yield* db
        .delete(paymentProviderConfigurations)
        .where(inArray(paymentProviderConfigurations.id, rows.providerConfigs))
        .pipe(Effect.ignore);
    }
    if (rows.locations.length > 0) {
      yield* db
        .delete(paywallLocations)
        .where(inArray(paywallLocations.id, rows.locations))
        .pipe(Effect.ignore);
    }
    if (rows.products.length > 0) {
      yield* db.delete(products).where(inArray(products.id, rows.products)).pipe(Effect.ignore);
    }
    if (rows.perks.length > 0) {
      yield* db.delete(perks).where(inArray(perks.id, rows.perks)).pipe(Effect.ignore);
    }
  });

/**
 * Wrap a test body so every row it seeds is removed afterward, regardless of how
 * the test exits. The body receives a {@link Tracker}; cleanup reads the
 * collected ids lazily at finalization via `Effect.ensuring`, so it sees every
 * id tracked while the body ran (including on failure).
 */
const withCleanup = <E, R>(
  body: (track: Tracker) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R | Db> => {
  const rows: CreatedRows = {
    products: [],
    perks: [],
    locations: [],
    productPerks: [],
    providerConfigs: [],
    providerConfigProducts: [],
  };
  const track: Tracker = {
    product: (id) => rows.products.push(id),
    perk: (id) => rows.perks.push(id),
    location: (id) => rows.locations.push(id),
    productPerk: (id) => rows.productPerks.push(id),
    providerConfig: (id) => rows.providerConfigs.push(id),
    providerConfigProduct: (id) => rows.providerConfigProducts.push(id),
  };
  return body(track).pipe(Effect.ensuring(cleanupCreatedRows(rows)));
};

// --- raw seed helpers (the service has no mutating API of its own) ----------

const insertPerk = (track: Tracker, input: { name: string; slug: string }) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const id = generateId("perk");
    track.perk(id);
    yield* db.insert(perks).values({ id, name: input.name, projectId, slug: input.slug });
    return id;
  });

const insertProduct = (
  track: Tracker,
  input: { name: string; slug: string; type?: ProductTypeValue },
) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const id = generateId("product");
    track.product(id);
    yield* db
      .insert(products)
      .values({ id, name: input.name, projectId, slug: input.slug, type: input.type });
    return id;
  });

const insertProductPerkLink = (track: Tracker, input: { productId: string; perkId: string }) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const id = generateId("productPerk");
    track.productPerk(id);
    yield* db.insert(productPerks).values({ id, perkId: input.perkId, productId: input.productId });
    return id;
  });

const insertLocation = (
  track: Tracker,
  input: { name: string; slug: string; description?: string | null; archivedAt?: Date | null },
) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const id = generateId("paywallLocation");
    track.location(id);
    yield* db.insert(paywallLocations).values({
      id,
      name: input.name,
      projectId,
      slug: input.slug,
      description: input.description ?? null,
      archivedAt: input.archivedAt ?? null,
    });
    return id;
  });

const insertProviderConfig = (
  track: Tracker,
  input: { providerId: string; enabled: boolean; deleted?: boolean },
) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const id = generateId("paymentProviderConfiguration");
    track.providerConfig(id);
    let deletedAt: Date | null = null;
    if (input.deleted) deletedAt = yield* DateTime.nowAsDate;
    yield* db.insert(paymentProviderConfigurations).values({
      id,
      providerId: input.providerId,
      projectId,
      paymentProviderKey: `it-key-${id}`,
      enabled: input.enabled,
      name: `cfg-${input.providerId}`,
      deletedAt,
    });
    return id;
  });

const insertProviderProductMapping = (
  track: Tracker,
  input: {
    configurationId: string;
    productId: string;
    isActive?: boolean;
    configuration?: object;
  },
) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const id = generateId("paymentProviderProduct");
    track.providerConfigProduct(id);
    yield* db.insert(paymentProviderConfigurationProducts).values({
      id,
      paymentProviderConfigurationId: input.configurationId,
      productId: input.productId,
      providerProductKey: `it-ppk-${id}`,
      isActive: input.isActive ?? true,
      configuration: input.configuration ?? {},
    });
    return id;
  });

// --- hash oracle ------------------------------------------------------------

/**
 * Recompute the expected `sha256:` version hash from the canonical projection,
 * mirroring `src/services/schema/helpers.ts#computeSchemaVersion` byte-for-byte
 * (field order, sort order, and the `{ locations, perks, products }` envelope
 * that intentionally omits `enabledProviders`). Proves the service's hash is
 * deterministic against the exact same layout the CLI reproduces.
 */
const expectedVersion = (projection: {
  perks: ReadonlyArray<{ slug: string; name: string }>;
  locations: ReadonlyArray<{ slug: string; name: string; description: string | null }>;
  products: ReadonlyArray<{
    slug: string;
    name: string;
    type: "subscription";
    perks: ReadonlyArray<string>;
    providers: ReadonlyArray<{ providerId: string; configuration: unknown }>;
  }>;
}): Effect.Effect<string> =>
  Effect.gen(function* () {
    const products = [...projection.products]
      .map((product) => ({
        name: product.name,
        perks: [...product.perks].sort(),
        providers: [...product.providers]
          .map((provider) => ({
            providerId: provider.providerId,
            configuration: provider.configuration,
          }))
          .sort((a, b) => a.providerId.localeCompare(b.providerId)),
        slug: product.slug,
        type: product.type,
      }))
      .sort((a, b) => a.slug.localeCompare(b.slug));
    const locations = [...projection.locations]
      .map((location) => ({
        description: location.description,
        name: location.name,
        slug: location.slug,
      }))
      .sort((a, b) => a.slug.localeCompare(b.slug));
    const perksList = [...projection.perks]
      .map((perk) => ({ name: perk.name, slug: perk.slug }))
      .sort((a, b) => a.slug.localeCompare(b.slug));
    const payload = encodeJsonValue({ locations, perks: perksList, products });
    const hashBuffer = yield* Effect.promise(() =>
      subtle.digest("SHA-256", new TextEncoder().encode(payload)),
    );
    const hashHex = [...new Uint8Array(hashBuffer)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    return `sha256:${hashHex}`;
  });

/** A `user`-method session for the fixture principal carrying no project access. */
const sessionWithoutProjectAccess = (): UserSession => ({
  cookie: null,
  method: "user",
  name: `${CoreTestFixture.userName} <${CoreTestFixture.userEmail}>`,
  organizations: [],
  person: null,
  projects: [],
  user: {
    createdAt: dateAtMillis(0),
    email: CoreTestFixture.userEmail,
    emailVerified: true,
    id: CoreTestFixture.userId,
    image: null,
    name: CoreTestFixture.userName,
    role: null,
    updatedAt: dateAtMillis(0),
    workosUserId: CoreTestFixture.workosUserId,
  },
});

/**
 * Run a single call as a caller with no project access. The inner provision
 * shadows the harness's default full-permission session for the wrapped call.
 */
const asUnauthorized = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(CoreAuthSession.authenticate(sessionWithoutProjectAccess()));

describe("SchemaService.getProjectSchema", () => {
  test(
    "returns the cached ProjectSchema without re-reading the DB on a cache hit",
    withCleanup((track) =>
      Effect.gen(function* () {
        const schemaService = yield* SchemaService;
        const cache = yield* ProjectSchemaCache;

        // Seed a perk so a fresh assembly would differ from the planted cache value.
        const slug = yield* uniqueSlug("cache-hit");
        yield* insertPerk(track, { name: "Cache Hit Perk", slug });

        // Plant a sentinel schema the service must return verbatim on a hit.
        const sentinel = {
          enabledProviders: [],
          locations: [],
          perks: [{ slug: "sentinel", name: "Sentinel" }],
          products: [],
          version: "sha256:sentinel",
        };
        yield* cache.getByName(projectId).set(sentinel, 60_000);

        const schema = yield* schemaService.getProjectSchema(projectId);
        // Returned object is the exact cached value, not a freshly assembled one.
        expect(schema.version).toBe("sha256:sentinel");
        expect(schema.perks.some((p) => p.slug === "sentinel")).toBe(true);
        expect(schema.perks.some((p) => p.slug === slug)).toBe(false);
      }),
    ).pipe(Effect.provide(SchemaService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "assembles the schema from the DB on a cache miss and caches the result",
    withCleanup((track) =>
      Effect.gen(function* () {
        const schemaService = yield* SchemaService;
        const cache = yield* ProjectSchemaCache;

        const perkSlug = yield* uniqueSlug("miss-perk");
        const productSlug = yield* uniqueSlug("miss-product");
        const consumableSlug = yield* uniqueSlug("miss-consumable");
        const locationSlug = yield* uniqueSlug("miss-location");

        const perkId = yield* insertPerk(track, { name: "Miss Perk", slug: perkSlug });
        const productId = yield* insertProduct(track, { name: "Miss Product", slug: productSlug });
        yield* insertProduct(track, {
          name: "Miss Consumable",
          slug: consumableSlug,
          type: ProductType.OneTimeConsumable,
        });
        yield* insertProductPerkLink(track, { productId, perkId });
        yield* insertLocation(track, {
          name: "Miss Location",
          slug: locationSlug,
          description: "a location",
        });
        const appleCfg = yield* insertProviderConfig(track, {
          providerId: "apple-app-store",
          enabled: true,
        });
        yield* insertProviderProductMapping(track, {
          configurationId: appleCfg,
          productId,
          configuration: { foo: "bar" },
        });

        // Empty cache → forces a DB assembly.
        const before = yield* cache.getByName(projectId).get();
        expect(before).toBeNull();

        const schema = yield* schemaService.getProjectSchema(projectId);

        // Seeded rows surface (membership, never exact counts — the fixture is shared).
        expect(schema.perks.some((p) => p.slug === perkSlug && p.name === "Miss Perk")).toBe(true);
        expect(
          schema.locations.some((l) => l.slug === locationSlug && l.description === "a location"),
        ).toBe(true);
        const seededProduct = schema.products.find((p) => p.slug === productSlug);
        expect(seededProduct).toBeDefined();
        expect(seededProduct?.type).toBe("subscription");
        expect(seededProduct?.perks).toContain(perkSlug);
        expect(seededProduct?.providers.some((pr) => pr.providerId === "appleAppStore")).toBe(true);
        expect(schema.products.find((product) => product.slug === consumableSlug)?.type).toBe(
          "one-time-consumable",
        );
        expect(
          seededProduct?.providers.find((pr) => pr.providerId === "appleAppStore")?.configuration,
        ).toEqual({ foo: "bar" });
        expect(schema.enabledProviders).toContain("appleAppStore");
        expect(schema.version.startsWith("sha256:")).toBe(true);

        // The assembled schema is now persisted in the cache.
        const after = yield* cache.getByName(projectId).get();
        expect(after).not.toBeNull();
        expect(cachedVersion(after)).toBe(schema.version);
      }),
    ).pipe(Effect.provide(SchemaService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all and assembles nothing",
    // No cleanup wrapper: the guarded read fails before touching the DB.
    Effect.gen(function* () {
      const schemaService = yield* SchemaService;
      const cache = yield* ProjectSchemaCache;

      const error = yield* Effect.flip(asUnauthorized(schemaService.getProjectSchema(projectId)));
      expect(error).toBeInstanceOf(ActionForbiddenError);

      // The forbidden path neither assembled nor cached anything.
      const cached = yield* cache.getByName(projectId).get();
      expect(cached).toBeNull();
    }).pipe(Effect.provide(SchemaService.layer), CoreAuthSession.authenticate()),
  );

  vitestTest.todo(
    "fails with SchemaServiceError when a DB read fails — needs an in-process seam to force a DatabaseError from the live PlanetScale connection (the catchTags only fires on infra failure); not reproducible cleanly against the real DB without hand-rolling a DB double, which the harness forbids",
  );
});

describe("SchemaService.getProjectSchemaForSdk", () => {
  test(
    "returns a ProjectSchema without any permission check (publishable-key middleware resolves projectId)",
    withCleanup((track) =>
      Effect.gen(function* () {
        const schemaService = yield* SchemaService;

        const perkSlug = yield* uniqueSlug("sdk-perk");
        yield* insertPerk(track, { name: "SDK Perk", slug: perkSlug });

        // Even with a session that has NO project access, the SDK variant must succeed.
        const schema = yield* asUnauthorized(schemaService.getProjectSchemaForSdk(projectId));
        expect(schema.perks.some((p) => p.slug === perkSlug)).toBe(true);
        expect(schema.version.startsWith("sha256:")).toBe(true);
      }),
    ).pipe(Effect.provide(SchemaService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "returns the cached schema if one is present",
    withCleanup((track) =>
      Effect.gen(function* () {
        const schemaService = yield* SchemaService;
        const cache = yield* ProjectSchemaCache;

        const slug = yield* uniqueSlug("sdk-cache-hit");
        yield* insertPerk(track, { name: "SDK Cache Hit", slug });

        const sentinel = {
          enabledProviders: [],
          locations: [],
          perks: [{ slug: "sdk-sentinel", name: "SDK Sentinel" }],
          products: [],
          version: "sha256:sdk-sentinel",
        };
        yield* cache.getByName(projectId).set(sentinel, 60_000);

        const schema = yield* schemaService.getProjectSchemaForSdk(projectId);
        expect(schema.version).toBe("sha256:sdk-sentinel");
        expect(schema.perks.some((p) => p.slug === "sdk-sentinel")).toBe(true);
        expect(schema.perks.some((p) => p.slug === slug)).toBe(false);
      }),
    ).pipe(Effect.provide(SchemaService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "assembles a fresh schema and caches it on a miss",
    withCleanup((track) =>
      Effect.gen(function* () {
        const schemaService = yield* SchemaService;
        const cache = yield* ProjectSchemaCache;

        const slug = yield* uniqueSlug("sdk-miss");
        yield* insertPerk(track, { name: "SDK Miss", slug });

        const before = yield* cache.getByName(projectId).get();
        expect(before).toBeNull();

        const schema = yield* schemaService.getProjectSchemaForSdk(projectId);
        expect(schema.perks.some((p) => p.slug === slug)).toBe(true);

        const after = yield* cache.getByName(projectId).get();
        expect(after).not.toBeNull();
        expect(cachedVersion(after)).toBe(schema.version);
      }),
    ).pipe(Effect.provide(SchemaService.layer), CoreAuthSession.authenticate()),
  );
});

describe("SchemaService.computeProjectSchemaVersion", () => {
  test(
    "returns the same version hash the assembled schema carries",
    withCleanup((track) =>
      Effect.gen(function* () {
        const schemaService = yield* SchemaService;

        const slug = yield* uniqueSlug("version-perk");
        yield* insertPerk(track, { name: "Version Perk", slug });

        const schema = yield* schemaService.getProjectSchema(projectId);
        const { version } = yield* schemaService.computeProjectSchemaVersion(projectId);
        expect(version).toBe(schema.version);
        expect(version.startsWith("sha256:")).toBe(true);
      }),
    ).pipe(Effect.provide(SchemaService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "forbids callers without project:all",
    Effect.gen(function* () {
      const schemaService = yield* SchemaService;
      const error = yield* Effect.flip(
        asUnauthorized(schemaService.computeProjectSchemaVersion(projectId)),
      );
      expect(error).toBeInstanceOf(ActionForbiddenError);
    }).pipe(Effect.provide(SchemaService.layer), CoreAuthSession.authenticate()),
  );
});

describe("SchemaService schema assembly (via getProjectSchema)", () => {
  test(
    "excludes archived paywall locations",
    withCleanup((track) =>
      Effect.gen(function* () {
        const schemaService = yield* SchemaService;

        const activeSlug = yield* uniqueSlug("loc-active");
        const archivedSlug = yield* uniqueSlug("loc-archived");
        yield* insertLocation(track, { name: "Active", slug: activeSlug });
        const archivedAt = yield* DateTime.nowAsDate;
        yield* insertLocation(track, {
          name: "Archived",
          slug: archivedSlug,
          archivedAt,
        });

        const schema = yield* schemaService.getProjectSchema(projectId);
        expect(schema.locations.some((l) => l.slug === activeSlug)).toBe(true);
        expect(schema.locations.some((l) => l.slug === archivedSlug)).toBe(false);
      }),
    ).pipe(Effect.provide(SchemaService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "ignores provider mappings whose configuration is soft-deleted",
    withCleanup((track) =>
      Effect.gen(function* () {
        const schemaService = yield* SchemaService;

        const productSlug = yield* uniqueSlug("softdel-product");
        const productId = yield* insertProduct(track, {
          name: "SoftDel Product",
          slug: productSlug,
        });

        // Active config + active mapping → surfaces.
        const liveCfg = yield* insertProviderConfig(track, {
          providerId: "apple-app-store",
          enabled: true,
        });
        yield* insertProviderProductMapping(track, { configurationId: liveCfg, productId });

        // Soft-deleted config (deletedAt set) + active mapping → must be filtered out.
        const deadCfg = yield* insertProviderConfig(track, {
          providerId: "google-play",
          enabled: true,
          deleted: true,
        });
        yield* insertProviderProductMapping(track, { configurationId: deadCfg, productId });

        const schema = yield* schemaService.getProjectSchema(projectId);
        const product = schema.products.find((p) => p.slug === productSlug);
        expect(product).toBeDefined();
        expect(product?.providers.some((pr) => pr.providerId === "appleAppStore")).toBe(true);
        // googlePlay came only from the soft-deleted configuration → dropped.
        expect(product?.providers.some((pr) => pr.providerId === "googlePlay")).toBe(false);
      }),
    ).pipe(Effect.provide(SchemaService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "ignores provider mappings whose link is inactive (isActive = false)",
    withCleanup((track) =>
      Effect.gen(function* () {
        const schemaService = yield* SchemaService;

        const productSlug = yield* uniqueSlug("inactive-product");
        const productId = yield* insertProduct(track, {
          name: "Inactive Product",
          slug: productSlug,
        });

        const cfg = yield* insertProviderConfig(track, {
          providerId: "apple-app-store",
          enabled: true,
        });
        yield* insertProviderProductMapping(track, {
          configurationId: cfg,
          productId,
          isActive: false,
        });

        const schema = yield* schemaService.getProjectSchema(projectId);
        const product = schema.products.find((p) => p.slug === productSlug);
        expect(product).toBeDefined();
        // The only mapping was inactive, so the product surfaces no providers.
        expect(product?.providers.length).toBe(0);
      }),
    ).pipe(Effect.provide(SchemaService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "drops providers the schema contract does not surface (e.g. stripe) from products and enabledProviders",
    withCleanup((track) =>
      Effect.gen(function* () {
        const schemaService = yield* SchemaService;

        const productSlug = yield* uniqueSlug("stripe-product");
        const productId = yield* insertProduct(track, {
          name: "Stripe Product",
          slug: productSlug,
        });

        // stripe is not in DB_PROVIDER_ID_TO_SCHEMA → mapDbProviderIdToSchemaProviderId returns null.
        const stripeCfg = yield* insertProviderConfig(track, {
          providerId: "stripe",
          enabled: true,
        });
        yield* insertProviderProductMapping(track, { configurationId: stripeCfg, productId });

        const appleCfg = yield* insertProviderConfig(track, {
          providerId: "apple-app-store",
          enabled: true,
        });
        yield* insertProviderProductMapping(track, { configurationId: appleCfg, productId });

        const schema = yield* schemaService.getProjectSchema(projectId);
        const product = schema.products.find((p) => p.slug === productSlug);
        expect(product).toBeDefined();
        expect(product?.providers.some((pr) => pr.providerId === "appleAppStore")).toBe(true);
        // stripe is unmappable, so it never appears as a schema providerId.
        expect(product?.providers.map((pr) => pr.providerId)).not.toContain("stripe");
        // enabledProviders is the surfaceable subset (only ever apple / google literals).
        expect(schema.enabledProviders).toContain("appleAppStore");
        expect(schema.enabledProviders).not.toContain("stripe");
      }),
    ).pipe(Effect.provide(SchemaService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "produces a deterministic version hash matching the canonical projection byte layout",
    withCleanup((track) =>
      Effect.gen(function* () {
        const schemaService = yield* SchemaService;
        const db = yield* Db;

        // Seed a known set of rows for THIS project.
        const perkSlug = yield* uniqueSlug("hash-perk");
        const productSlug = yield* uniqueSlug("hash-product");
        const locationSlug = yield* uniqueSlug("hash-location");

        const perkId = yield* insertPerk(track, { name: "Hash Perk", slug: perkSlug });
        const productId = yield* insertProduct(track, { name: "Hash Product", slug: productSlug });
        yield* insertProductPerkLink(track, { productId, perkId });
        yield* insertLocation(track, {
          name: "Hash Location",
          slug: locationSlug,
          description: null,
        });
        const appleCfg = yield* insertProviderConfig(track, {
          providerId: "apple-app-store",
          enabled: true,
        });
        yield* insertProviderProductMapping(track, {
          configurationId: appleCfg,
          productId,
          configuration: { tier: 1 },
        });

        const schema = yield* schemaService.getProjectSchema(projectId);

        // Reconstruct the canonical projection from ALL current project rows so the
        // oracle hashes exactly what the service assembled (the fixture is shared,
        // so we read the live state rather than assume only our seeds exist).
        const allPerks = yield* db.query.perks.findMany({ where: { projectId } });
        const allProducts = yield* db.query.products.findMany({ where: { projectId } });
        const activeLocations = schema.locations.map((l) => ({
          slug: l.slug,
          name: l.name,
          description: l.description,
        }));

        const projectionProducts = allProducts.map((product) => {
          const fromSchema = schema.products.find((p) => p.slug === product.slug);
          if (!fromSchema) {
            return {
              slug: product.slug,
              name: product.name,
              type: constant("subscription"),
              perks: [],
              providers: [],
            };
          }
          return {
            slug: product.slug,
            name: product.name,
            type: constant("subscription"),
            perks: [...fromSchema.perks],
            providers: fromSchema.providers.map((pr) => ({
              providerId: pr.providerId,
              configuration: pr.configuration,
            })),
          };
        });

        const oracle = yield* expectedVersion({
          perks: allPerks.map((p) => ({ slug: p.slug, name: p.name })),
          locations: activeLocations,
          products: projectionProducts,
        });

        expect(schema.version).toBe(oracle);
      }),
    ).pipe(Effect.provide(SchemaService.layer), CoreAuthSession.authenticate()),
  );

  test(
    "sorts perks, locations, and products alphabetically by slug",
    withCleanup((track) =>
      Effect.gen(function* () {
        const schemaService = yield* SchemaService;

        // Insert in reverse-alphabetical order to prove the service re-sorts.
        const stamp = `${yield* Clock.currentTimeMillis}-${slugSeq++}`;
        const perkZ = `it-schema-sort-perk-z-${stamp}`;
        const perkA = `it-schema-sort-perk-a-${stamp}`;
        const prodZ = `it-schema-sort-prod-z-${stamp}`;
        const prodA = `it-schema-sort-prod-a-${stamp}`;
        const locZ = `it-schema-sort-loc-z-${stamp}`;
        const locA = `it-schema-sort-loc-a-${stamp}`;

        yield* insertPerk(track, { name: "Z", slug: perkZ });
        yield* insertPerk(track, { name: "A", slug: perkA });
        yield* insertProduct(track, { name: "Z", slug: prodZ });
        yield* insertProduct(track, { name: "A", slug: prodA });
        yield* insertLocation(track, { name: "Z", slug: locZ });
        yield* insertLocation(track, { name: "A", slug: locA });

        const schema = yield* schemaService.getProjectSchema(projectId);

        const perkIdxA = schema.perks.findIndex((p) => p.slug === perkA);
        const perkIdxZ = schema.perks.findIndex((p) => p.slug === perkZ);
        expect(perkIdxA).toBeGreaterThanOrEqual(0);
        expect(perkIdxZ).toBeGreaterThan(perkIdxA);

        const prodIdxA = schema.products.findIndex((p) => p.slug === prodA);
        const prodIdxZ = schema.products.findIndex((p) => p.slug === prodZ);
        expect(prodIdxA).toBeGreaterThanOrEqual(0);
        expect(prodIdxZ).toBeGreaterThan(prodIdxA);

        const locIdxA = schema.locations.findIndex((l) => l.slug === locA);
        const locIdxZ = schema.locations.findIndex((l) => l.slug === locZ);
        expect(locIdxA).toBeGreaterThanOrEqual(0);
        expect(locIdxZ).toBeGreaterThan(locIdxA);
      }),
    ).pipe(Effect.provide(SchemaService.layer), CoreAuthSession.authenticate()),
  );
});
