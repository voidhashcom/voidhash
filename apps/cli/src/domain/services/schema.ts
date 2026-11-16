import { constant } from "@voidhash/lib/lang";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";

import { ApiClient, readAll } from "../../utils/api-client";
import { RemoteSchemaFetchError } from "../errors/schema";
import {
  type ProviderId,
  createEmptyNormalizedSchema,
  type NormalizedSchema,
} from "../schema/normalized-schema";
import * as Arr from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as Schema from "effect/Schema";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";

const SUPPORTED_PROVIDER_IDS: HashSet.HashSet<string> = HashSet.make("appleAppStore", "googlePlay");

/** Narrows a provider id reported by the API to one the CLI understands. */
const isSupportedProviderId = (providerId: string): providerId is ProviderId =>
  HashSet.has(SUPPORTED_PROVIDER_IDS, providerId);

/**
 * A feature flag as `voidhash.gen.d.ts` types it: its key, and the distinct
 * text values of its variants, sorted. A flag whose variants hold no text
 * (a `boolean` or `number` flag) has none.
 */
export const GeneratedFeatureFlag = Schema.Struct({
  key: Schema.String,
  values: Schema.Array(Schema.String),
});
export type GeneratedFeatureFlag = typeof GeneratedFeatureFlag.Type;

/**
 * A variant's value as the API sends it. The generated client does not type
 * JSON fields, so it is read off the object.
 */
const variantValue = (variant: object): unknown => ("value" in variant ? variant.value : null);

const make = Effect.fn("make")(function* effect() {
  const apiClient = yield* ApiClient;

  /**
   * Fetch the project's full schema (perks, locations, products, provider
   * configs) from the server's consolidated
   * `GET /api/v1/projects/{projectId}/schema` endpoint and project it into the
   * CLI's `NormalizedSchema`.
   *
   * Replaces the five round-trips the CLI used to make against the
   * per-entity endpoints. The server is now the canonical source for the
   * version hash too — we no longer re-derive it on the client.
   */
  const fetchRemoteSchema = (projectId: string) =>
    Effect.fn("fetchRemoteSchema")(function* fetchRemoteSchema() {
      yield* Effect.logDebug("Fetching remote schema from API");
      const response = yield* apiClient.schemaGet(projectId);

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
   * `GET /api/v1/projects/{projectId}/schema/version` endpoint so we don't
   * ship the whole schema just to compare hashes.
   */
  const fetchSchemaVersion = (projectId: string) =>
    Effect.fn("fetchSchemaVersion")(function* fetchSchemaVersion() {
      const response = yield* apiClient.schemaGetVersion(projectId);
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

  /**
   * The project's flags apps receive (archived ones left out), sorted by key,
   * each with the text values its variants hold. Only `string` and `json`
   * flags can hold text, so only theirs are listed: one request per such flag.
   */
  const fetchFeatureFlags = (projectId: string) =>
    Effect.fn("fetchFeatureFlags")(function* fetchFeatureFlags() {
      const flags = yield* readAll((query) =>
        apiClient.featureFlagsList(projectId, { ...query, isArchived: "false" }),
      );
      const generated = yield* Effect.forEach(
        flags,
        (flag) =>
          flag.type === "string" || flag.type === "json"
            ? Effect.map(
                readAll((query) => apiClient.featureFlagsListVariants(projectId, flag.id, query)),
                (variants): GeneratedFeatureFlag => ({
                  key: flag.key,
                  values: Arr.sort(
                    Arr.dedupe(Arr.filter(Arr.map(variants, variantValue), P.isString)),
                    Order.String,
                  ),
                }),
              )
            : Effect.succeed<GeneratedFeatureFlag>({ key: flag.key, values: [] }),
        { concurrency: 4 },
      );
      return Arr.sort(
        generated,
        Order.mapInput(Order.String, (flag: GeneratedFeatureFlag) => flag.key),
      );
    })().pipe(
      Effect.withSpan("SchemaService.fetchFeatureFlags"),
      Effect.catch((e) =>
        Effect.fail(
          new RemoteSchemaFetchError({
            cause: e,
          }),
        ),
      ),
    );

  return constant({
    fetchFeatureFlags,
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
