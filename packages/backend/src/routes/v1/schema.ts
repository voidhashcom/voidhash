/**
 * `GET /api/v1/schema` and `GET /api/v1/schema/version` — the CLI-facing
 * consolidated schema reads. Both share the underlying `SchemaService` query
 * and honour `If-None-Match` against the `sha256:<hex>` version hash so the
 * CLI watch loop and SDK drift-warning paths can revalidate cheaply.
 */
import {
  ProjectSchemaResponse,
  SchemaLocation,
  SchemaPerk,
  SchemaProduct,
  SchemaProductProvider,
  SchemaVersion,
  VoidhashV1Api,
} from "@voidhash/api-contracts";
import { ApiActionForbiddenError, ApiSchemaServiceError } from "@voidhash/api-contracts/errors";
import { SchemaService } from "@voidhash/core/services";
import { extractAuthorizedProjectId } from "@voidhash/core/utils";
import { constant } from "@voidhash/lib/lang";
import { AuthSession } from "@voidhash/rpc";
import { Effect, Option } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import * as HttpHeaders from "effect/unstable/http/Headers";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { bridgeAuthSession } from "../../ApiMiddlewares.ts";

const SCHEMA_CACHE_HEADERS = constant({
  "cache-control": "no-cache, must-revalidate",
});

/**
 * Returns a `304 Not Modified` response when the client's `If-None-Match`
 * matches the current schema version. Returns `undefined` otherwise so the
 * caller can serve the body.
 */
export const schemaNotModifiedResponse = (
  ifNoneMatch: string | undefined,
  version: string,
): HttpServerResponse.HttpServerResponse | undefined => {
  if (!ifNoneMatch) {
    return undefined;
  }
  const trimmed = ifNoneMatch.replace(/^"|"$/g, "");
  if (trimmed !== version) {
    return undefined;
  }
  return HttpServerResponse.empty({
    status: 304,
    headers: { ...SCHEMA_CACHE_HEADERS, etag: `"${version}"` },
  });
};

export const schemaResponseHeaders = (version: string): Record<string, string> => ({
  ...SCHEMA_CACHE_HEADERS,
  etag: `"${version}"`,
});

export const SchemaGroupLive = HttpApiBuilder.group(VoidhashV1Api, "schema", (handlers) =>
  Effect.gen(function* () {
    const schemaService = yield* SchemaService;

    return handlers
      .handle("getSchema", () =>
        Effect.gen(function* () {
          const req = yield* HttpServerRequest.HttpServerRequest;
          const ifNoneMatch = HttpHeaders.get(req.headers, "if-none-match");

          return yield* bridgeAuthSession(
            Effect.gen(function* () {
              const authSession = yield* AuthSession;
              const projectId = yield* extractAuthorizedProjectId(authSession);
              const schema = yield* schemaService.getProjectSchema(projectId);

              const notModified = schemaNotModifiedResponse(
                Option.getOrUndefined(ifNoneMatch),
                schema.version,
              );
              if (notModified) {
                return notModified;
              }

              return yield* HttpServerResponse.schemaJson(ProjectSchemaResponse)(
                new ProjectSchemaResponse({
                  enabledProviders: schema.enabledProviders,
                  locations: schema.locations.map((location) => new SchemaLocation(location)),
                  perks: schema.perks.map((perk) => new SchemaPerk(perk)),
                  products: schema.products.map(
                    (product) =>
                      new SchemaProduct({
                        duration: product.duration,
                        name: product.name,
                        perks: product.perks,
                        providers: product.providers.map(
                          (provider) => new SchemaProductProvider(provider),
                        ),
                        slug: product.slug,
                        type: product.type,
                      }),
                  ),
                  version: schema.version,
                }),
                { headers: schemaResponseHeaders(schema.version) },
              ).pipe(Effect.orDie);
            }),
          );
        }).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            SchemaServiceError: (e) => Effect.fail(new ApiSchemaServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("getSchemaVersion", () =>
        Effect.gen(function* () {
          const req = yield* HttpServerRequest.HttpServerRequest;
          const ifNoneMatch = HttpHeaders.get(req.headers, "if-none-match");

          return yield* bridgeAuthSession(
            Effect.gen(function* () {
              const authSession = yield* AuthSession;
              const projectId = yield* extractAuthorizedProjectId(authSession);
              const { version } = yield* schemaService.computeProjectSchemaVersion(projectId);

              const notModified = schemaNotModifiedResponse(
                Option.getOrUndefined(ifNoneMatch),
                version,
              );
              if (notModified) {
                return notModified;
              }

              return yield* HttpServerResponse.schemaJson(SchemaVersion)(
                new SchemaVersion({ version }),
                { headers: schemaResponseHeaders(version) },
              ).pipe(Effect.orDie);
            }),
          );
        }).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            SchemaServiceError: (e) => Effect.fail(new ApiSchemaServiceError({ cause: e.cause })),
          }),
        ),
      );
  }),
);
