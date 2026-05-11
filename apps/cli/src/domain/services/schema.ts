import { Effect, Layer, ServiceMap } from "effect";

import { ApiClient } from "../../utils/api-client";
import { RemoteSchemaFetchError } from "../errors/schema";
import {
  type ProviderId,
  createEmptyNormalizedSchema,
  type NormalizedSchema,
} from "../schema/normalized-schema";

const make = Effect.gen(function* effect() {
  const apiClient = yield* ApiClient;

  /**
   * Fetch the full schema (perks, locations, products, provider configs) from
   * the server's consolidated `GET /api/v1/schema` endpoint and project it
   * into the CLI's `NormalizedSchema`.
   *
   * Replaces the five round-trips the CLI used to make against the
   * per-entity endpoints. The server is now the canonical source for the
   * version hash too — we no longer re-derive it on the client.
   */
  const fetchRemoteSchema = () =>
    Effect.gen(function* fetchRemoteSchema() {
      yield* Effect.logDebug("Fetching remote schema from API");
      const response = yield* apiClient.schemaGetSchema();

      const schema: NormalizedSchema = createEmptyNormalizedSchema();

      for (const perk of response.perks) {
        schema.perks.set(perk.slug, {
          name: perk.name,
          slug: perk.slug,
        });
      }

      for (const location of response.locations) {
        schema.locations.set(location.slug, {
          description: location.description,
          name: location.name,
          slug: location.slug,
        });
      }

      const SUPPORTED_PROVIDER_IDS: ReadonlySet<string> = new Set<ProviderId>([
        "appleAppStore",
        "googlePlay",
      ]);

      for (const product of response.products) {
        schema.products.set(product.slug, {
          name: product.name,
          perks: [...product.perks],
          providers: product.providers
            .filter((provider) =>
              SUPPORTED_PROVIDER_IDS.has(provider.providerId as string)
            )
            .map((provider) => ({
              configuration: provider.configuration,
              providerId: provider.providerId as ProviderId,
            })),
          slug: product.slug,
          type: product.type,
        });
      }

      for (const providerId of response.enabledProviders) {
        schema.enabledProviders.add(providerId);
      }

      yield* Effect.logDebug(
        `Fetched ${schema.locations.size} locations, ${schema.perks.size} perks, ${schema.products.size} products`
      );

      // The server-side version is the canonical hash and trumps any local
      // re-derivation. Surface it so callers (codegen, `types check`) can
      // bake it into the `.d.ts` header / compare against the local one.
      return { schema, version: response.version };
    }).pipe(
      Effect.withSpan("SchemaService.fetchRemoteSchema"),
      Effect.catch((e) =>
        Effect.fail(
          new RemoteSchemaFetchError({
            cause: e,
          })
        )
      )
    );

  /**
   * Cheap version probe used by `voidhash-cli types check`, the `--watch` poll
   * loop, and (indirectly) the dev-mode SDK drift warning. Hits the dedicated
   * `GET /api/v1/schema/version` endpoint so we don't ship the whole schema
   * just to compare hashes.
   */
  const fetchSchemaVersion = () =>
    Effect.gen(function* fetchSchemaVersion() {
      const response = yield* apiClient.schemaGetSchemaVersion();
      return response.version;
    }).pipe(
      Effect.withSpan("SchemaService.fetchSchemaVersion"),
      Effect.catch((e) =>
        Effect.fail(
          new RemoteSchemaFetchError({
            cause: e,
          })
        )
      )
    );

  return {
    fetchRemoteSchema,
    fetchSchemaVersion,
  } as const;
});

type SchemaServiceShape = Effect.Success<typeof make>;

export class SchemaService extends ServiceMap.Service<
  SchemaService,
  SchemaServiceShape
>()("voidhash-cli/Schema") {
  static Default = Layer.effect(SchemaService, make).pipe(
    Layer.provide(ApiClient.Default)
  );
}
