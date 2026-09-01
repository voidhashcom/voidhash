import { constant } from "@voidhash/lib/lang";
import * as Arr from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
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

const decodeDiagnostics = Schema.decodeUnknownOption(
  Schema.Array(
    Schema.Struct({
      message: Schema.String,
      phase: Schema.optional(Schema.String),
      line: Schema.optional(Schema.Number),
      column: Schema.optional(Schema.Number),
    }),
  ),
);

const NO_DIAGNOSTICS: ReadonlyArray<ComponentManifestDiagnostic> = [];

/** Payload for {@link ComponentManifestCacheService.record}. */
export interface RecordComponentManifestInput {
  readonly sourceHash: string;
  readonly status: "ready" | "error";
  readonly manifest?: unknown;
  readonly previewTrees?: Readonly<Record<string, unknown>>;
  readonly diagnostics?: ReadonlyArray<ComponentManifestDiagnostic>;
}

/**
 * A resolved cache row: the compile status plus, when `ready`, the validated
 * {@link ComponentManifest}. `error` rows carry no manifest or preview trees.
 */
export interface CachedComponentManifest {
  readonly sourceHash: string;
  readonly status: "ready" | "error";
  readonly manifest: Option.Option<ComponentManifest>;
  readonly previewTrees: Option.Option<Readonly<Record<string, unknown>>>;
  readonly diagnostics: ReadonlyArray<ComponentManifestDiagnostic>;
}

type CachedComponentManifestEntry = readonly [string, CachedComponentManifest];

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
       * replaces the deploy-side `ComponentManifestDefinition` decode — the workspace
       * cache stores the v2 (id-less) manifest the browser/container compiler
       * extracts, which the document-first tools consume directly.
       */
      const decodeManifest = (
        input: unknown,
      ): Effect.Effect<ComponentManifest, ComponentManifestInvalidError> => {
        const result = parseComponentManifest(input);
        if (result.ok) return Effect.succeed(result.value);
        return Effect.fail(
          new ComponentManifestInvalidError({
            message: `manifest failed validation: ${result.errors.join("; ")}`,
          }),
        );
      };

      /**
       * Content-addressed, **first-write-wins** upsert of one compile result. A
       * `ready` status validates the supplied manifest against the core schema
       * before storing it with the optional renderer-ready preview trees; an
       * `error` status stores diagnostics with a null manifest and preview.
       *
       * A row that is already `ready` is IMMUTABLE: because the row is keyed by
       * the content hash of the source, any conflicting write carries the same
       * source and so cannot legitimately differ — the `setWhere` clause makes
       * the conflicting UPDATE a no-op, so a later (possibly adversarial) writer
       * can never replace an existing ready manifest. A legacy ready row whose
       * preview trees are still null may be filled once without replacing the
       * manifest. An `error` row MAY be upgraded — error→ready once the source
       * finally compiles somewhere, or error→error to refresh diagnostics.
       */
      const record = Effect.fn("componentManifestCache.record")(
        function* (input: RecordComponentManifestInput) {
          yield* Effect.annotateCurrentSpan(
            "voidhash.paywall.component_source_hash",
            input.sourceHash,
          );

          const manifest = yield* input.status === "ready"
            ? Option.match(Option.fromNullishOr(input.manifest), {
                onNone: () =>
                  Effect.fail(
                    new ComponentManifestInvalidError({
                      message: `A "ready" manifest upload for ${input.sourceHash} carried no manifest.`,
                    }),
                  ),
                onSome: (value) =>
                  decodeManifest(value).pipe(
                    Effect.map(Option.some),
                    Effect.mapError(
                      (error) =>
                        new ComponentManifestInvalidError({
                          message: `Component manifest for ${input.sourceHash} ${error.message}`,
                        }),
                    ),
                  ),
              })
            : Effect.succeed(Option.none<ComponentManifest>());

          const diagnostics = input.diagnostics ?? [];
          // Only a `ready` upload carries preview trees; `error` rows clear them.
          const previewTrees =
            input.status === "ready"
              ? Option.fromNullishOr(input.previewTrees)
              : Option.none<Readonly<Record<string, unknown>>>();
          const updatedAt = yield* DateTime.nowAsDate;
          yield* db
            .insert(paywallComponentManifests)
            .values({
              sourceHash: input.sourceHash,
              status: input.status,
              manifest: Option.getOrNull(manifest),
              previewTrees: Option.getOrNull(previewTrees),
              diagnostics,
            })
            .onConflictDoUpdate({
              target: paywallComponentManifests.sourceHash,
              set: {
                status: sql`CASE WHEN ${paywallComponentManifests.status} = 'error' THEN excluded.status ELSE ${paywallComponentManifests.status} END`,
                manifest: sql`CASE WHEN ${paywallComponentManifests.status} = 'error' THEN excluded.manifest ELSE ${paywallComponentManifests.manifest} END`,
                previewTrees: sql`CASE WHEN ${paywallComponentManifests.status} = 'error' OR (${paywallComponentManifests.previewTrees} IS NULL AND excluded.status = 'ready') THEN excluded.preview_trees ELSE ${paywallComponentManifests.previewTrees} END`,
                diagnostics: sql`CASE WHEN ${paywallComponentManifests.status} = 'error' THEN excluded.diagnostics ELSE ${paywallComponentManifests.diagnostics} END`,
                updatedAt,
              },
              // Keep a ready derivation immutable, except for filling the new
              // preview-tree column on rows recorded before it existed.
              setWhere: sql`${paywallComponentManifests.status} = 'error' OR (${paywallComponentManifests.previewTrees} IS NULL AND excluded.status = 'ready')`,
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
          const distinct = [...HashSet.fromIterable(sourceHashes)];
          if (Arr.isReadonlyArrayEmpty(distinct)) {
            return HashMap.empty<string, CachedComponentManifest>();
          }
          const rows = yield* db.query.paywallComponentManifests.findMany({
            where: { sourceHash: { in: distinct } },
          });
          const entries = yield* Effect.forEach(
            rows,
            (row): Effect.Effect<Option.Option<CachedComponentManifestEntry>> => {
              const diagnostics = Option.getOrElse(
                decodeDiagnostics(row.diagnostics ?? []),
                () => NO_DIAGNOSTICS,
              );
              if (row.status !== "ready") {
                return Effect.succeed(
                  Option.some([
                    row.sourceHash,
                    {
                      sourceHash: row.sourceHash,
                      status: "error",
                      manifest: Option.none<ComponentManifest>(),
                      previewTrees: Option.none<Readonly<Record<string, unknown>>>(),
                      diagnostics,
                    },
                  ] satisfies CachedComponentManifestEntry),
                );
              }
              return decodeManifest(row.manifest).pipe(
                Effect.option,
                Effect.map(
                  Option.map(
                    (manifest) =>
                      [
                        row.sourceHash,
                        {
                          sourceHash: row.sourceHash,
                          status: "ready",
                          manifest: Option.some(manifest),
                          previewTrees: Option.fromNullishOr(row.previewTrees),
                          diagnostics,
                        },
                      ] satisfies CachedComponentManifestEntry,
                  ),
                ),
              );
            },
            { concurrency: 1 },
          );
          return HashMap.fromIterable(Arr.getSomes(entries));
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new ComponentManifestCacheError({ message: String(error.cause) })),
            }),
          ),
      );

      return constant({ record, getMany });
    }),
  },
) {
  static layer = Layer.effect(ComponentManifestCacheService)(ComponentManifestCacheService.make);
}
