import { Context, Effect, Layer, Schema } from "effect";
import { sql } from "drizzle-orm";

import { Db, paywallComponentManifests } from "@voidhash/db";
import { parseComponentManifest, type ComponentManifest } from "@voidhash/paywalls/schema";

/**
 * Catch-all error raised by {@link ComponentManifestCacheService} public
 * methods — wraps DB failures at the boundary so callers see one stable tag.
 */
export class ComponentManifestCacheError extends Schema.TaggedErrorClass<ComponentManifestCacheError>(
  "ComponentManifestCacheError",
)("ComponentManifestCacheError", { message: Schema.String }) {}

/**
 * Raised when a recorded manifest fails validation against the OSS v2 component
 * manifest format ({@link parseComponentManifest}). A `ready` upload MUST carry a
 * well-formed manifest; an `error` upload carries none. A v1 / id-bearing
 * manifest is rejected (v2 dropped the manifest `id` — identity is the file path).
 */
export class ComponentManifestInvalidError extends Schema.TaggedErrorClass<ComponentManifestInvalidError>(
  "ComponentManifestInvalidError",
)("ComponentManifestInvalidError", { message: Schema.String }) {}

/** One cached diagnostic (message + optional position/phase). */
export interface ComponentManifestDiagnostic {
  readonly message: string;
  readonly phase?: string;
  readonly line?: number;
  readonly column?: number;
}

/** Payload for {@link ComponentManifestCacheService.record}. */
export interface RecordComponentManifestInput {
  readonly sourceHash: string;
  readonly status: "ready" | "error";
  readonly manifest?: unknown;
  readonly diagnostics?: ReadonlyArray<ComponentManifestDiagnostic>;
}

/**
 * A resolved cache row: the compile status plus, when `ready`, the validated
 * {@link ComponentManifest}. `error` rows carry `manifest: null`.
 */
export interface CachedComponentManifest {
  readonly sourceHash: string;
  readonly status: "ready" | "error";
  readonly manifest: ComponentManifest | null;
  readonly diagnostics: ReadonlyArray<ComponentManifestDiagnostic>;
}

/**
 * `ComponentManifestCacheService` owns the content-addressed component-manifest
 * cache (`paywall_component_manifest`, keyed by the browser-shared `sourceHash`).
 * It is the write side of the headless-read gap: the browser uploads a manifest
 * after every compile so any component ever compiled in a designer session is
 * server-resolvable, and the document-first AI/MCP tools read rows back by source
 * hash to resolve each local code-component's props/actions when reading or
 * editing a paywall document server-side.
 *
 * The cache is intentionally **unscoped** — a manifest is a pure derivation of
 * source content (see the schema jsdoc). Authorization is enforced at the RPC
 * layer (any authenticated caller may contribute manifests; the derivation
 * leaks nothing). `Db` is provided by the application root.
 */
export class ComponentManifestCacheService extends Context.Service<ComponentManifestCacheService>()(
  "ComponentManifestCacheService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;

      /**
       * Validate an unknown value as an OSS v2 {@link ComponentManifest} on the
       * Effect channel: a `parseComponentManifest` failure fails with a
       * {@link ComponentManifestInvalidError} carrying the joined reasons. This
       * replaces the deploy-side `ComponentManifestSchema` decode — the workspace
       * cache stores the v2 (id-less) manifest the browser/container compiler
       * extracts, which the document-first tools consume directly.
       */
      const decodeManifest = (
        input: unknown,
      ): Effect.Effect<ComponentManifest, ComponentManifestInvalidError> => {
        const result = parseComponentManifest(input);
        return result.ok
          ? Effect.succeed(result.value)
          : Effect.fail(
              new ComponentManifestInvalidError({
                message: `manifest failed validation: ${result.errors.join("; ")}`,
              }),
            );
      };

      /**
       * Content-addressed, **first-write-wins** upsert of one compile result. A
       * `ready` status validates the supplied manifest against the core schema
       * before storing; an `error` status stores diagnostics with a null
       * manifest.
       *
       * A row that is already `ready` is IMMUTABLE: because the row is keyed by
       * the content hash of the source, any conflicting write carries the same
       * source and so cannot legitimately differ — the `setWhere` clause makes
       * the conflicting UPDATE a no-op, so a later (possibly adversarial) writer
       * can never replace an existing ready manifest. An `error` row MAY be
       * upgraded — error→ready once the source finally compiles somewhere, or
       * error→error to refresh diagnostics.
       */
      const record = Effect.fn("componentManifestCache.record")(
        function* (input: RecordComponentManifestInput) {
          yield* Effect.annotateCurrentSpan("voidhash.paywall.component_source_hash", input.sourceHash);

          let manifest: ComponentManifest | null = null;
          if (input.status === "ready") {
            if (input.manifest === undefined) {
              return yield* Effect.fail(
                new ComponentManifestInvalidError({
                  message: `A "ready" manifest upload for ${input.sourceHash} carried no manifest.`,
                }),
              );
            }
            manifest = yield* decodeManifest(input.manifest).pipe(
              Effect.mapError(
                (error) =>
                  new ComponentManifestInvalidError({
                    message: `Component manifest for ${input.sourceHash} ${error.message}`,
                  }),
              ),
            );
          }

          const diagnostics = input.diagnostics ?? [];
          yield* db
            .insert(paywallComponentManifests)
            .values({
              sourceHash: input.sourceHash,
              status: input.status,
              manifest,
              diagnostics,
            })
            .onConflictDoUpdate({
              target: paywallComponentManifests.sourceHash,
              set: { status: input.status, manifest, diagnostics, updatedAt: new Date() },
              // First-write-wins: only overwrite an `error` row. The bare table
              // reference in a Postgres `ON CONFLICT DO UPDATE ... WHERE` names
              // the existing row, so a `ready` row is left untouched.
              setWhere: sql`${paywallComponentManifests.status} = 'error'`,
            });
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new ComponentManifestCacheError({ message: String(error.cause) })),
            }),
          ),
      );

      /**
       * Loads the cached rows for a set of source hashes, indexed by hash.
       * Hashes with no row (never compiled anywhere) are simply absent from the
       * map — callers treat that as a cache miss and degrade. `ready` rows whose
       * stored manifest somehow fails re-validation are also dropped (defensive:
       * an older/corrupt row must not crash a read), leaving the component
       * unresolved in the registry.
       */
      const getMany = Effect.fn("componentManifestCache.getMany")(
        function* (sourceHashes: ReadonlyArray<string>) {
          const result = new Map<string, CachedComponentManifest>();
          const distinct = [...new Set(sourceHashes)];
          if (distinct.length === 0) {
            return result;
          }
          const rows = yield* db.query.paywallComponentManifests.findMany({
            where: { sourceHash: { in: distinct } },
          });
          for (const row of rows) {
            const diagnostics = (row.diagnostics ?? []) as ReadonlyArray<ComponentManifestDiagnostic>;
            if (row.status === "ready") {
              const manifest = yield* decodeManifest(row.manifest).pipe(
                Effect.map((value): ComponentManifest | null => value),
                Effect.orElseSucceed(() => null),
              );
              if (manifest === null) {
                continue;
              }
              result.set(row.sourceHash, {
                sourceHash: row.sourceHash,
                status: "ready",
                manifest,
                diagnostics,
              });
            } else {
              result.set(row.sourceHash, {
                sourceHash: row.sourceHash,
                status: "error",
                manifest: null,
                diagnostics,
              });
            }
          }
          return result;
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new ComponentManifestCacheError({ message: String(error.cause) })),
            }),
          ),
      );

      return { record, getMany } as const;
    }),
  },
) {
  static layer = Layer.effect(ComponentManifestCacheService)(ComponentManifestCacheService.make);
}
