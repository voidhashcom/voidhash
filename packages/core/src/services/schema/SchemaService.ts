import { constant } from "@voidhash/lib/lang";
import { Context, Effect, Layer, Schema } from "effect";
import type { ProductTypeValue, SubscriptionDurationValue } from "@voidhash/lib";

import { AuthSession } from "../../domain/auth/Auth.ts";
import {
  ProjectSchema,
  SchemaLocation,
  SchemaPerk,
  SchemaProduct,
  SchemaProductProvider,
  type SchemaProviderId,
} from "../../domain/schema/Schema.ts";
import {
  Db,
  and,
  asc,
  eq,
  isNull,
  paymentProviderConfigurationProducts,
  paymentProviderConfigurations,
  perks,
  productPerks,
  products,
} from "@voidhash/db";
import { checkProjectPermission } from "../../utils/permissions.ts";
import {
  type SchemaProjection,
  computeSchemaVersion,
  mapDbProviderIdToSchemaProviderId,
} from "./helpers.ts";
import { dbProductTypeToLabel, dbSubscriptionDurationToLabel } from "../products/helpers.ts";

export interface ProjectSchemaCacheStub {
  readonly get: () => Effect.Effect<unknown>;
  readonly set: (schema: unknown, ttlMs: number) => Effect.Effect<void>;
  readonly invalidate: () => Effect.Effect<void>;
}

export interface ProjectSchemaCacheShape {
  readonly getByName: (projectId: string) => ProjectSchemaCacheStub;
}

/**
 * Cache port for project schemas. The Cloudflare backend provides a
 * `ProjectSchemaCacheDO` namespace; tests and non-Worker runtimes can provide
 * an in-memory implementation without pulling Alchemy resources into the
 * service layer.
 */
export class ProjectSchemaCache extends Context.Service<
  ProjectSchemaCache,
  ProjectSchemaCacheShape
>()("ProjectSchemaCache") {}

/**
 * Defense-in-depth TTL persisted alongside the cached schema entry. The cache
 * is primarily invalidated by {@link SchemaCacheInvalidationService}, which the
 * mutation services call directly on every schema-shaping write; the TTL is
 * only recorded for telemetry / forensics inside the `ProjectSchemaCacheDO`
 * storage entry.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Catch-all service error. Wraps `DatabaseError` (and other infrastructural
 * failures) at the public-method boundary so callers see one stable error tag.
 */
/** `products.type` is a plain smallint column mirroring the `ProductType` enum. */
const asProductType = (type: any): ProductTypeValue => type;
const asSubscriptionDuration = (duration: any): SubscriptionDurationValue | null => duration;

/** `payment_provider_configuration_product.configuration` is an untyped JSON column. */
const asConfigurationRecord = (configuration: any): Record<string, unknown> => configuration;

export class SchemaServiceError extends Schema.TaggedErrorClass<SchemaServiceError>(
  "SchemaServiceError",
)("SchemaServiceError", { cause: Schema.String }) {}

/**
 * `SchemaService` assembles the consolidated project schema (perks, paywall
 * locations, products, enabled providers) consumed by both the CLI
 * (`GET /api/v1/schema`) and the SDK runtime (`GET /sdk/schema`).
 *
 * Reads are cached behind {@link ProjectSchemaCache}, which routes each
 * project to one Durable Object instance via `namespace.getByName(projectId)`
 * — the single-writer property that used to come from the Effect cluster
 * sharded `ProjectSchemaEntity`. Cache entries are dropped by
 * {@link SchemaCacheInvalidationService} (lives in
 * `./SchemaCacheInvalidationService.ts`), which the mutation services call
 * directly after a write; the next read here repopulates lazily.
 *
 * `Db`, `ProjectSchemaCache`, `AuthSession`, and the rest are provided by
 * the application root.
 */
export class SchemaService extends Context.Service<SchemaService>()("SchemaService", {
  make: Effect.gen(function* () {
    const cache = yield* ProjectSchemaCache;
    const db = yield* Db;

    const assembleFromDb = Effect.fn("schema.assembleFromDb")(
      function* (projectId: string) {
        yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
        const [
          dbPerks,
          dbProducts,
          dbLocations,
          dbProductPerkLinks,
          dbProductProviderMappings,
          dbEnabledProviders,
        ] = yield* Effect.all(
          [
            Effect.gen(function* () {
              return yield* db.query.perks.findMany({
                orderBy: { slug: "asc" },
                where: { projectId },
              });
            }),
            Effect.gen(function* () {
              return yield* db.query.products.findMany({
                orderBy: { slug: "asc" },
                where: { projectId },
              });
            }),
            // Archived locations are not part of the schema the SDK / CLI
            // cares about — mirror `findActiveLocationBySlug`.
            Effect.gen(function* () {
              return yield* db.query.paywallLocations.findMany({
                orderBy: { slug: "asc" },
                where: { projectId, archivedAt: { isNull: true } },
              });
            }),
            // One row per (product, perk) link, projected to the perk slug
            // the handler actually needs (it doesn't care about perk id).
            Effect.gen(function* () {
              const rows = yield* db
                .select({
                  perkSlug: perks.slug,
                  productId: productPerks.productId,
                })
                .from(productPerks)
                .innerJoin(products, eq(productPerks.productId, products.id))
                .innerJoin(perks, eq(productPerks.perkId, perks.id))
                .where(eq(products.projectId, projectId))
                .orderBy(asc(perks.slug));
              return rows.map((row) => ({
                perkSlug: row.perkSlug,
                productId: row.productId,
              }));
            }),
            // Active per-product provider mappings joined with the parent
            // configuration row (so we can ignore mappings whose
            // configuration was soft-deleted, and read the parent's
            // `providerId`).
            Effect.gen(function* () {
              const rows = yield* db
                .select({
                  configuration: paymentProviderConfigurationProducts.configuration,
                  productId: paymentProviderConfigurationProducts.productId,
                  providerId: paymentProviderConfigurations.providerId,
                })
                .from(paymentProviderConfigurationProducts)
                .innerJoin(
                  products,
                  eq(paymentProviderConfigurationProducts.productId, products.id),
                )
                .innerJoin(
                  paymentProviderConfigurations,
                  eq(
                    paymentProviderConfigurationProducts.paymentProviderConfigurationId,
                    paymentProviderConfigurations.id,
                  ),
                )
                .where(
                  and(
                    eq(products.projectId, projectId),
                    eq(paymentProviderConfigurationProducts.isActive, true),
                    isNull(paymentProviderConfigurations.deletedAt),
                  ),
                )
                .orderBy(
                  asc(paymentProviderConfigurations.providerId),
                  asc(paymentProviderConfigurationProducts.createdAt),
                );
              return rows.map((row) => ({
                configuration: row.configuration,
                productId: row.productId,
                providerId: row.providerId,
              }));
            }),
            // Set of providerIds with at least one enabled, non-deleted
            // configuration in the project — drives `enabledProviders` on
            // the CLI response.
            Effect.gen(function* () {
              const rows = yield* db
                .select({ providerId: paymentProviderConfigurations.providerId })
                .from(paymentProviderConfigurations)
                .where(
                  and(
                    eq(paymentProviderConfigurations.projectId, projectId),
                    eq(paymentProviderConfigurations.enabled, true),
                    isNull(paymentProviderConfigurations.deletedAt),
                  ),
                )
                .orderBy(asc(paymentProviderConfigurations.providerId));
              return rows.map((row) => ({ providerId: row.providerId }));
            }),
          ],
          { concurrency: "unbounded" },
        );

        const perkRows = dbPerks
          .map((perk) => ({ name: perk.name, slug: perk.slug }))
          .sort((a, b) => a.slug.localeCompare(b.slug));

        const locationRows = dbLocations
          .map((location) => ({
            description: location.description,
            name: location.name,
            slug: location.slug,
          }))
          .sort((a, b) => a.slug.localeCompare(b.slug));

        const perkSlugsByProductId = new Map<string, string[]>();
        for (const link of dbProductPerkLinks) {
          const list = perkSlugsByProductId.get(link.productId);
          if (list) {
            list.push(link.perkSlug);
          } else {
            perkSlugsByProductId.set(link.productId, [link.perkSlug]);
          }
        }

        // Drop providers the schema contract doesn't surface (e.g. `"stripe"`).
        // Filtering server-side keeps the version hash stable across CLI and
        // server.
        const providersByProductId = new Map<
          string,
          Array<{
            readonly providerId: SchemaProviderId;
            readonly configuration: Record<string, unknown>;
          }>
        >();
        for (const mapping of dbProductProviderMappings) {
          const providerId = mapDbProviderIdToSchemaProviderId(mapping.providerId);
          if (!providerId) {
            continue;
          }
          const configuration = asConfigurationRecord(mapping.configuration ?? {});
          const entry = { providerId, configuration };
          const list = providersByProductId.get(mapping.productId);
          if (list) {
            list.push(entry);
          } else {
            providersByProductId.set(mapping.productId, [entry]);
          }
        }

        const productRows = dbProducts
          .map((product) => {
            const perksForProduct = (perkSlugsByProductId.get(product.id) ?? []).slice().sort();
            const providersForProduct = (providersByProductId.get(product.id) ?? [])
              .slice()
              .sort((a, b) => a.providerId.localeCompare(b.providerId));
            return {
              name: product.name,
              duration: dbSubscriptionDurationToLabel(asSubscriptionDuration(product.duration)),
              perks: perksForProduct,
              providers: providersForProduct,
              slug: product.slug,
              type: dbProductTypeToLabel(asProductType(product.type)),
            };
          })
          .sort((a, b) => a.slug.localeCompare(b.slug));

        const enabledProvidersSet = new Set<SchemaProviderId>();
        for (const row of dbEnabledProviders) {
          const providerId = mapDbProviderIdToSchemaProviderId(row.providerId);
          if (providerId) {
            enabledProvidersSet.add(providerId);
          }
        }
        const enabledProviders: ReadonlyArray<SchemaProviderId> = [...enabledProvidersSet].sort();

        const projection: SchemaProjection = {
          enabledProviders,
          locations: locationRows,
          perks: perkRows,
          products: productRows,
        };
        const version = yield* computeSchemaVersion(projection);

        yield* Effect.annotateCurrentSpan("voidhash.schema.version", version);
        yield* Effect.annotateCurrentSpan("voidhash.schema.product_count", productRows.length);
        yield* Effect.annotateCurrentSpan("voidhash.schema.perk_count", perkRows.length);
        yield* Effect.annotateCurrentSpan("voidhash.schema.location_count", locationRows.length);
        yield* Effect.annotateCurrentSpan(
          "voidhash.schema.enabled_provider_count",
          enabledProviders.length,
        );

        return new ProjectSchema({
          enabledProviders,
          locations: locationRows.map((row) => new SchemaLocation(row)),
          perks: perkRows.map((row) => new SchemaPerk(row)),
          products: productRows.map(
            (row) =>
              new SchemaProduct({
                name: row.name,
                duration: row.duration,
                perks: row.perks,
                providers: row.providers.map((p) => new SchemaProductProvider(p)),
                slug: row.slug,
                type: row.type,
              }),
          ),
          version,
        });
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new SchemaServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    /**
     * Assemble a fresh schema from the database and persist it to the cache.
     *
     * The cache lives behind a Durable Object, and the DO bridge serializes
     * values crossing the boundary — a `Schema.Class` instance cannot survive
     * that round-trip intact (it would either fail to serialize or arrive with
     * its class identity stripped). We therefore store the plain *encoded*
     * form and reconstruct the instance on read. See {@link ProjectSchemaCache}.
     */
    const assembleAndCache = (projectId: string, stub: ProjectSchemaCacheStub) =>
      Effect.gen(function* () {
        const fresh = yield* assembleFromDb(projectId);
        const encoded = yield* Schema.encodeUnknownEffect(ProjectSchema)(fresh).pipe(Effect.orDie);
        yield* stub.set(encoded, CACHE_TTL_MS);
        return fresh;
      });

    const fetchOrAssemble = (projectId: string) =>
      Effect.gen(function* () {
        const stub = cache.getByName(projectId);
        const cached = yield* stub.get();
        if (cached === null || cached === undefined) {
          yield* Effect.annotateCurrentSpan("voidhash.schema.cache_hit", false);
          return yield* assembleAndCache(projectId, stub);
        }
        // The cached payload is opaque plain JSON after the DO round-trip —
        // decode it back into a `ProjectSchema`. A decode failure means a
        // stale or shape-incompatible entry; treat that as a miss and
        // re-assemble rather than failing the read.
        return yield* Schema.decodeUnknownEffect(ProjectSchema)(cached).pipe(
          Effect.tap(() => Effect.annotateCurrentSpan("voidhash.schema.cache_hit", true)),
          Effect.catch(() =>
            Effect.annotateCurrentSpan("voidhash.schema.cache_hit", false).pipe(
              Effect.andThen(() => assembleAndCache(projectId, stub)),
            ),
          ),
        );
      });

    const getProjectSchema = Effect.fn("schema.getProjectSchema")(function* (projectId: string) {
      const session = yield* AuthSession;
      yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
      yield* Effect.annotateCurrentSpan("voidhash.auth.method", session.method);
      if (session.user?.id) {
        yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
      }
      const scopedProject = session.projects.find((project) => project.id === projectId);
      if (scopedProject?.organizationId) {
        yield* Effect.annotateCurrentSpan("voidhash.organization.id", scopedProject.organizationId);
      }
      if (session.person?.distinctId) {
        yield* Effect.annotateCurrentSpan("voidhash.person.distinct_id", session.person.distinctId);
      }
      yield* checkProjectPermission(
        projectId,
        "project:all",
        `User ${session?.user?.id ?? "anonymous"} is not authorized to access schema for project ${projectId}`,
      );
      return yield* fetchOrAssemble(projectId);
    });

    /**
     * SDK variant — the publishable-key middleware on the SDK route resolves
     * `projectId` from the authenticated key before calling this, and that
     * middleware is the only thing that can ever put a `projectId` in scope,
     * so no in-service permission check is needed.
     */
    const getProjectSchemaForSdk = Effect.fn("schema.getProjectSchemaForSdk")(function* (
      projectId: string,
    ) {
      yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
      return yield* fetchOrAssemble(projectId);
    });

    const computeProjectSchemaVersion = Effect.fn("schema.computeProjectSchemaVersion")(function* (
      projectId: string,
    ) {
      yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
      const schema = yield* getProjectSchema(projectId);
      yield* Effect.annotateCurrentSpan("voidhash.schema.version", schema.version);
      return { version: schema.version };
    });

    return constant({
      computeProjectSchemaVersion,
      getProjectSchema,
      getProjectSchemaForSdk,
    });
  }),
}) {
  static layer = Layer.effect(SchemaService)(SchemaService.make);
}
