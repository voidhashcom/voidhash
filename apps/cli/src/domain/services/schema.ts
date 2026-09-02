import { constant } from "@voidhash/lib/lang";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";

import { ApiClient } from "../../utils/api-client";
import { RemoteSchemaFetchError } from "../errors/schema";
import {
  type ProviderId,
  createEmptyNormalizedSchema,
  type NormalizedSchema,
} from "../schema/normalized-schema";
import * as Arr from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";

const SUPPORTED_PROVIDER_IDS: HashSet.HashSet<string> = HashSet.make("appleAppStore", "googlePlay");

/** Narrows a provider id reported by the API to one the CLI understands. */
const isSupportedProviderId = (providerId: string): providerId is ProviderId =>
  HashSet.has(SUPPORTED_PROVIDER_IDS, providerId);

const make = Effect.fn("make")(function* effect() {
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
    Effect.fn("fetchRemoteSchema")(function* fetchRemoteSchema() {
      yield* Effect.logDebug("Fetching remote schema from API");
      const response = yield* apiClient.schemaGetSchema();

      const schema: NormalizedSchema = createEmptyNormalizedSchema();

      Arr.forEach(response.perks, (perk) => {
        MutableHashMap.set(schema.perks, perk.slug, {
          name: perk.name,
          slug: perk.slug,
        });
      });

      Arr.forEach(response.locations, (location) => {
        MutableHashMap.set(schema.locations, location.slug, {
          description: location.description,
          name: location.name,
          slug: location.slug,
        });
      });

      Arr.forEach(response.products, (product) => {
        MutableHashMap.set(schema.products, product.slug, {
          duration: product.duration,
          name: product.name,
          perks: [...product.perks],
          providers: product.providers.flatMap((provider) => {
            if (!isSupportedProviderId(provider.providerId)) return [];
            return [
              {
                configuration: provider.configuration,
                providerId: provider.providerId,
              },
            ];
          }),
          slug: product.slug,
          type: product.type,
        });
      });

      Arr.forEach(response.enabledProviders, (providerId) => {
        MutableHashSet.add(schema.enabledProviders, providerId);
      });

      yield* Effect.logDebug(
        `Fetched ${MutableHashMap.size(schema.locations)} locations, ${MutableHashMap.size(schema.perks)} perks, ${MutableHashMap.size(schema.products)} products`,
      );

      // The server-side version is the canonical hash and trumps any local
      // re-derivation. Surface it so callers (codegen, `types check`) can
      // bake it into the `.d.ts` header / compare against the local one.
      return { schema, version: response.version };
    })().pipe(
      Effect.withSpan("SchemaService.fetchRemoteSchema"),
      Effect.catch((e) =>
        Effect.fail(
          new RemoteSchemaFetchError({
            cause: e,
          }),
        ),
      ),
    );

  /**
   * Cheap version probe used by `voidhash-cli types check`, the `--watch` poll
   * loop, and (indirectly) the dev-mode SDK drift warning. Hits the dedicated
   * `GET /api/v1/schema/version` endpoint so we don't ship the whole schema
   * just to compare hashes.
   */
  const fetchSchemaVersion = () =>
    Effect.fn("fetchSchemaVersion")(function* fetchSchemaVersion() {
      const response = yield* apiClient.schemaGetSchemaVersion();
      return response.version;
    })().pipe(
      Effect.withSpan("SchemaService.fetchSchemaVersion"),
      Effect.catch((e) =>
        Effect.fail(
          new RemoteSchemaFetchError({
            cause: e,
          }),
        ),
      ),
    );

  return constant({
    fetchRemoteSchema,
    fetchSchemaVersion,
  });
})();

type SchemaServiceShape = Effect.Success<typeof make>;

export class SchemaService extends Context.Service<SchemaService, SchemaServiceShape>()(
  "voidhash-cli/Schema",
) {
  static Default = Layer.effect(SchemaService, make).pipe(Layer.provide(ApiClient.Default));
}
