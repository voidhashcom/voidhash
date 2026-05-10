import { Effect, Layer, Schedule, ServiceMap } from "effect";

import { ApiClient } from "../../utils/api-client";
import { computeSchemaVersionFromNormalized } from "../../utils/schema/version";
import { RemoteSchemaFetchError } from "../errors/schema";
import {
  type ProviderId,
  createEmptyNormalizedSchema,
} from "../schema/normalized-schema";

const make = Effect.gen(function* effect() {
  const apiClient = yield* ApiClient;

  /**
   * Fetch the full schema (perks, locations, products, provider configs) from
   * the server. Used by `voidhash types generate` to assemble the data the
   * `.d.ts` is generated from.
   *
   * Once the server ships a consolidated `GET /schema` endpoint this collapses
   * to a single call; for now it composes the per-entity endpoints.
   */
  const fetchRemoteSchema = () =>
    Effect.gen(function* fetchRemoteSchema() {
      yield* Effect.logDebug("Fetching remote schema from API");
      const schema = createEmptyNormalizedSchema();

      // Perks
      const remotePerks = yield* apiClient.perksListPerks();
      for (const perk of remotePerks) {
        schema.perks.set(perk.slug, {
          name: perk.name,
          slug: perk.slug,
        });
      }

      // Paywall locations
      const remoteLocations =
        yield* apiClient.paywallLocationsListPaywallLocations();
      for (const location of remoteLocations) {
        schema.locations.set(location.slug, {
          description: location.description,
          name: location.name,
          slug: location.slug,
        });
      }

      // Products
      const remoteProducts = yield* apiClient.productsListProducts();

      // Payment provider configurations
      const providerConfigs =
        yield* apiClient.paymentProviderConfigurationsListPaymentProviderConfigurations();
      for (const config of providerConfigs) {
        if (
          config.providerId === "appleAppStore" ||
          config.providerId === "googlePlay"
        ) {
          schema.enabledProviders.add(config.providerId);
        }
      }

      // Payment provider products
      const providerProducts =
        yield* apiClient.paymentProviderProductsListPaymentProviderProducts();
      const productProviderMap = new Map<
        string,
        { providerId: ProviderId; configuration: Record<string, unknown> }[]
      >();
      for (const pp of providerProducts) {
        if (
          pp.providerId !== "appleAppStore" &&
          pp.providerId !== "googlePlay"
        ) {
          continue;
        }
        const existing = productProviderMap.get(pp.productId) || [];
        existing.push({
          configuration: pp.configuration as Record<string, unknown>,
          providerId: pp.providerId,
        });
        productProviderMap.set(pp.productId, existing);
      }

      // For each product, fetch its perks
      yield* Effect.all(
        remoteProducts.map((product) =>
          Effect.gen(function* () {
            const productPerks = yield* apiClient
              .productPerksListProductPerksByProductId(product.id)
              .pipe(
                Effect.retry({
                  schedule: Schedule.exponential(1000),
                  times: 3,
                }),
              );

            const perkSlugs: string[] = [];
            for (const pp of productPerks) {
              const perk = remotePerks.find((p) => p.id === pp.perkId);
              if (perk) {
                perkSlugs.push(perk.slug);
              }
            }

            schema.products.set(product.slug, {
              name: product.name,
              perks: perkSlugs,
              providers: productProviderMap.get(product.id) || [],
              slug: product.slug,
              type: "subscription",
            });
          }),
        ),
        {
          concurrency: 8,
        },
      );

      yield* Effect.logDebug(
        `Fetched ${schema.locations.size} locations, ${schema.perks.size} perks, ${schema.products.size} products`
      );
      return schema;
    }).pipe(
      Effect.withSpan("SchemaService.fetchRemoteSchema"),
      Effect.catch(
        (e) =>
          Effect.fail(new RemoteSchemaFetchError({
            cause: e,
          })),
      ),
    );

  /**
   * Fetch just the schema version hash from the server. Used by `types check`,
   * the `--watch` poll loop, and the dev-mode runtime warning to detect
   * staleness cheaply without re-downloading the full schema.
   *
   * Today this re-derives the version from the full schema fetch (since the
   * consolidated `GET /schema/version` endpoint isn't shipped yet). Once
   * that endpoint exists this collapses to a single sub-kilobyte request.
   */
  const fetchSchemaVersion = () =>
    Effect.gen(function* fetchSchemaVersion() {
      const schema = yield* fetchRemoteSchema();
      return computeSchemaVersionFromNormalized(schema);
    });

  return {
    fetchRemoteSchema,
    fetchSchemaVersion,
  } as const;
});

type SchemaServiceShape = Effect.Success<typeof make>;

export class SchemaService extends ServiceMap.Service<SchemaService, SchemaServiceShape>()(
  "voidhash-cli/Schema"
) {
  static Default = Layer.effect(SchemaService, make).pipe(
    Layer.provide(ApiClient.Default)
  );
}
