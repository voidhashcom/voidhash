import { Db } from "@voidhash/db";
import { constant } from "@voidhash/lib/lang";
import { Effect, Exit, Layer } from "effect";

import { describe, expect, it } from "../../testing/effect-vitest.ts";
import {
  ComponentManifestCacheService,
  type RecordComponentManifestInput,
} from "./ComponentManifestCacheService.ts";

interface Row {
  sourceHash: string;
  status: string;
  manifest: unknown;
  previewTrees?: unknown;
  diagnostics: unknown;
}

/** Mirrors the `fakeService` helper used by the sibling paywall-workspace unit tests. */
const fakeService = (impl: object): any => impl;

const readyManifest = {
  manifestVersion: constant(2),
  props: {},
  actions: {},
  slot: false,
  previewStates: ["default"],
  hostData: [],
};

/**
 * A tiny in-memory `Db` fake covering only the two calls the cache service makes:
 * `insert(...).values(...).onConflictDoUpdate(...)` and
 * `query.paywallComponentManifests.findMany({ where: { sourceHash: { in } } })`.
 *
 * The `onConflictDoUpdate` fake mirrors the real first-write-wins semantics: a
 * fresh key inserts; on conflict, an error row is replaced and a legacy ready
 * row may fill its missing preview trees. An existing ready derivation remains
 * otherwise immutable.
 */
const makeDbLayer = (seed: ReadonlyArray<Row> = []) => {
  const rows = new Map<string, Row>(seed.map((row) => [row.sourceHash, row]));

  const insert = () => ({
    values: (value: Row) => ({
      onConflictDoUpdate: () =>
        Effect.sync(() => {
          const existing = rows.get(value.sourceHash);
          if (existing === undefined || existing.status === "error") {
            rows.set(value.sourceHash, value);
          } else if (
            existing.status === "ready" &&
            existing.previewTrees == null &&
            value.status === "ready"
          ) {
            rows.set(value.sourceHash, { ...existing, previewTrees: value.previewTrees });
          }
        }),
    }),
  });

  const db = {
    insert,
    query: {
      paywallComponentManifests: {
        findMany: (args: { where: { sourceHash: { in: string[] } } }) =>
          Effect.sync(() =>
            args.where.sourceHash.in.flatMap((hash) => {
              const row = rows.get(hash);
              if (row === undefined) return [];
              return [row];
            }),
          ),
      },
    },
    __rows: rows,
  };

  return { layer: Layer.succeed(Db, fakeService(db)), rows };
};

const runRecord = (input: RecordComponentManifestInput, seed?: ReadonlyArray<Row>) => {
  const { layer, rows } = makeDbLayer(seed);
  const effect = Effect.gen(function* () {
    const cache = yield* ComponentManifestCacheService;
    yield* cache.record(input);
  }).pipe(Effect.provide(ComponentManifestCacheService.layer.pipe(Layer.provide(layer))));
  return { effect, rows };
};

describe("ComponentManifestCacheService.record", () => {
  it.effect("stores a validated manifest for a ready compile", () =>
    Effect.gen(function* () {
      const { effect, rows } = runRecord({
        sourceHash: "abc",
        status: "ready",
        manifest: readyManifest,
        previewTrees: { default: { type: "view" } },
      });
      expect(Exit.isSuccess(yield* Effect.exit(effect))).toBe(true);
      expect(rows.get("abc")?.status).toBe("ready");
      expect(rows.get("abc")?.manifest).toEqual(readyManifest);
      expect(rows.get("abc")?.previewTrees).toEqual({ default: { type: "view" } });
    }),
  );

  it.effect("stores diagnostics with a null manifest for an error compile", () =>
    Effect.gen(function* () {
      const { effect, rows } = runRecord({
        sourceHash: "err",
        status: "error",
        diagnostics: [{ message: "boom", phase: "compile" }],
      });
      expect(Exit.isSuccess(yield* Effect.exit(effect))).toBe(true);
      expect(rows.get("err")?.status).toBe("error");
      expect(rows.get("err")?.manifest).toBeNull();
    }),
  );

  it.effect("rejects a ready upload with no manifest", () =>
    Effect.gen(function* () {
      const { effect } = runRecord({ sourceHash: "x", status: "ready" });
      const resolved = yield* Effect.exit(effect);
      expect(Exit.isFailure(resolved)).toBe(true);
      if (Exit.isFailure(resolved)) {
        expect(resolved.cause.toString()).toContain("ComponentManifestInvalidError");
      }
    }),
  );

  it.effect("rejects a ready upload whose manifest fails schema validation", () =>
    Effect.gen(function* () {
      const { effect } = runRecord({
        sourceHash: "y",
        status: "ready",
        manifest: { manifestVersion: 99, id: "bad" },
      });
      const resolved = yield* Effect.exit(effect);
      expect(Exit.isFailure(resolved)).toBe(true);
      if (Exit.isFailure(resolved)) {
        expect(resolved.cause.toString()).toContain("ComponentManifestInvalidError");
      }
    }),
  );

  it.effect("is first-write-wins: a second ready record leaves the first ready row intact", () =>
    Effect.gen(function* () {
      const { layer, rows } = makeDbLayer([
        { sourceHash: "h", status: "ready", manifest: readyManifest, diagnostics: [] },
      ]);
      const conflicting = {
        manifestVersion: constant(2),
        title: "Other",
        props: {},
        actions: {},
        slot: false,
        previewStates: ["default"],
        hostData: [],
      };
      const exit = yield* Effect.exit(
        Effect.gen(function* () {
          const cache = yield* ComponentManifestCacheService;
          yield* cache.record({ sourceHash: "h", status: "ready", manifest: conflicting });
        }).pipe(Effect.provide(ComponentManifestCacheService.layer.pipe(Layer.provide(layer)))),
      );
      expect(Exit.isSuccess(exit)).toBe(true);
      expect(rows.get("h")?.manifest).toEqual(readyManifest);
    }),
  );

  it.effect("fills preview trees on a legacy ready row without replacing its manifest", () =>
    Effect.gen(function* () {
      const { layer, rows } = makeDbLayer([
        { sourceHash: "h", status: "ready", manifest: readyManifest, diagnostics: [] },
      ]);
      const conflicting = {
        ...readyManifest,
        title: "Other",
      };
      const exit = yield* Effect.exit(
        Effect.gen(function* () {
          const cache = yield* ComponentManifestCacheService;
          yield* cache.record({
            sourceHash: "h",
            status: "ready",
            manifest: conflicting,
            previewTrees: { default: { type: "text" } },
          });
        }).pipe(Effect.provide(ComponentManifestCacheService.layer.pipe(Layer.provide(layer)))),
      );
      expect(Exit.isSuccess(exit)).toBe(true);
      expect(rows.get("h")?.manifest).toEqual(readyManifest);
      expect(rows.get("h")?.previewTrees).toEqual({ default: { type: "text" } });
    }),
  );

  it.effect("upgrades an error row to ready", () =>
    Effect.gen(function* () {
      const { layer, rows } = makeDbLayer([
        { sourceHash: "h", status: "error", manifest: null, diagnostics: [{ message: "boom" }] },
      ]);
      const exit = yield* Effect.exit(
        Effect.gen(function* () {
          const cache = yield* ComponentManifestCacheService;
          yield* cache.record({ sourceHash: "h", status: "ready", manifest: readyManifest });
        }).pipe(Effect.provide(ComponentManifestCacheService.layer.pipe(Layer.provide(layer)))),
      );
      expect(Exit.isSuccess(exit)).toBe(true);
      expect(rows.get("h")?.status).toBe("ready");
      expect(rows.get("h")?.manifest).toEqual(readyManifest);
    }),
  );

  it.effect("does NOT downgrade a ready row to error", () =>
    Effect.gen(function* () {
      const { layer, rows } = makeDbLayer([
        { sourceHash: "h", status: "ready", manifest: readyManifest, diagnostics: [] },
      ]);
      const exit = yield* Effect.exit(
        Effect.gen(function* () {
          const cache = yield* ComponentManifestCacheService;
          yield* cache.record({
            sourceHash: "h",
            status: "error",
            diagnostics: [{ message: "later failure" }],
          });
        }).pipe(Effect.provide(ComponentManifestCacheService.layer.pipe(Layer.provide(layer)))),
      );
      expect(Exit.isSuccess(exit)).toBe(true);
      expect(rows.get("h")?.status).toBe("ready");
      expect(rows.get("h")?.manifest).toEqual(readyManifest);
    }),
  );
});

describe("ComponentManifestCacheService.getMany", () => {
  it.effect("returns ready manifests and error rows keyed by source hash; misses are absent", () =>
    Effect.gen(function* () {
      const { layer } = makeDbLayer([
        { sourceHash: "ready1", status: "ready", manifest: readyManifest, diagnostics: [] },
        {
          sourceHash: "err1",
          status: "error",
          manifest: null,
          diagnostics: [{ message: "nope" }],
        },
      ]);
      const result = yield* Effect.gen(function* () {
        const cache = yield* ComponentManifestCacheService;
        return yield* cache.getMany(["ready1", "err1", "missing"]);
      }).pipe(Effect.provide(ComponentManifestCacheService.layer.pipe(Layer.provide(layer))));
      expect(result.get("ready1")?.manifest).toEqual(readyManifest);
      expect(result.get("ready1")?.previewTrees).toBeNull();
      expect(result.get("err1")?.status).toBe("error");
      expect(result.get("err1")?.manifest).toBeNull();
      expect(result.has("missing")).toBe(false);
    }),
  );
});
