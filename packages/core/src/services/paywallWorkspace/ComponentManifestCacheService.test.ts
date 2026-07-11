import { Db } from "@voidhash/db";
import { Effect, Exit, Layer } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
  ComponentManifestCacheService,
  type RecordComponentManifestInput,
} from "./ComponentManifestCacheService.ts";

interface Row {
  sourceHash: string;
  status: string;
  manifest: unknown;
  diagnostics: unknown;
}

const readyManifest = {
  manifestVersion: 2 as const,
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
 * fresh key inserts; on conflict, the row is replaced ONLY when the existing row
 * has `status === "error"` (the `setWhere` gate). A `ready` row is immutable.
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
          }
        }),
    }),
  });

  const db = {
    insert,
    query: {
      paywallComponentManifests: {
        findMany: (args: { where: { sourceHash: { in: string[] } } }) =>
          Effect.sync(() => args.where.sourceHash.in.flatMap((h) => (rows.has(h) ? [rows.get(h)!] : []))),
      },
    },
    __rows: rows,
  };

  return { layer: Layer.succeed(Db, db as never), rows };
};

const runRecord = (input: RecordComponentManifestInput, seed?: ReadonlyArray<Row>) => {
  const { layer, rows } = makeDbLayer(seed);
  const exit = Effect.runPromiseExit(
    Effect.gen(function* () {
      const cache = yield* ComponentManifestCacheService;
      yield* cache.record(input);
    }).pipe(Effect.provide(ComponentManifestCacheService.layer.pipe(Layer.provide(layer)))),
  );
  return { exit, rows };
};

describe("ComponentManifestCacheService.record", () => {
  it("stores a validated manifest for a ready compile", async () => {
    const { exit, rows } = runRecord({
      sourceHash: "abc",
      status: "ready",
      manifest: readyManifest,
    });
    expect(Exit.isSuccess(await exit)).toBe(true);
    expect(rows.get("abc")?.status).toBe("ready");
    expect(rows.get("abc")?.manifest).toEqual(readyManifest);
  });

  it("stores diagnostics with a null manifest for an error compile", async () => {
    const { exit, rows } = runRecord({
      sourceHash: "err",
      status: "error",
      diagnostics: [{ message: "boom", phase: "compile" }],
    });
    expect(Exit.isSuccess(await exit)).toBe(true);
    expect(rows.get("err")?.status).toBe("error");
    expect(rows.get("err")?.manifest).toBeNull();
  });

  it("rejects a ready upload with no manifest", async () => {
    const { exit } = runRecord({ sourceHash: "x", status: "ready" });
    const resolved = await exit;
    expect(Exit.isFailure(resolved)).toBe(true);
    if (Exit.isFailure(resolved)) {
      expect(resolved.cause.toString()).toContain("ComponentManifestInvalidError");
    }
  });

  it("rejects a ready upload whose manifest fails schema validation", async () => {
    const { exit } = runRecord({
      sourceHash: "y",
      status: "ready",
      manifest: { manifestVersion: 99, id: "bad" },
    });
    const resolved = await exit;
    expect(Exit.isFailure(resolved)).toBe(true);
    if (Exit.isFailure(resolved)) {
      expect(resolved.cause.toString()).toContain("ComponentManifestInvalidError");
    }
  });

  it("is first-write-wins: a second ready record leaves the first ready row intact", async () => {
    const { layer, rows } = makeDbLayer([
      { sourceHash: "h", status: "ready", manifest: readyManifest, diagnostics: [] },
    ]);
    const conflicting = {
      manifestVersion: 2 as const,
      title: "Other",
      props: {},
      actions: {},
      slot: false,
      previewStates: ["default"],
      hostData: [],
    };
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const cache = yield* ComponentManifestCacheService;
        yield* cache.record({ sourceHash: "h", status: "ready", manifest: conflicting });
      }).pipe(Effect.provide(ComponentManifestCacheService.layer.pipe(Layer.provide(layer)))),
    );
    expect(Exit.isSuccess(exit)).toBe(true);
    expect(rows.get("h")?.manifest).toEqual(readyManifest);
  });

  it("upgrades an error row to ready", async () => {
    const { layer, rows } = makeDbLayer([
      { sourceHash: "h", status: "error", manifest: null, diagnostics: [{ message: "boom" }] },
    ]);
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const cache = yield* ComponentManifestCacheService;
        yield* cache.record({ sourceHash: "h", status: "ready", manifest: readyManifest });
      }).pipe(Effect.provide(ComponentManifestCacheService.layer.pipe(Layer.provide(layer)))),
    );
    expect(Exit.isSuccess(exit)).toBe(true);
    expect(rows.get("h")?.status).toBe("ready");
    expect(rows.get("h")?.manifest).toEqual(readyManifest);
  });

  it("does NOT downgrade a ready row to error", async () => {
    const { layer, rows } = makeDbLayer([
      { sourceHash: "h", status: "ready", manifest: readyManifest, diagnostics: [] },
    ]);
    const exit = await Effect.runPromiseExit(
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
  });
});

describe("ComponentManifestCacheService.getMany", () => {
  it("returns ready manifests and error rows keyed by source hash; misses are absent", async () => {
    const { layer } = makeDbLayer([
      { sourceHash: "ready1", status: "ready", manifest: readyManifest, diagnostics: [] },
      {
        sourceHash: "err1",
        status: "error",
        manifest: null,
        diagnostics: [{ message: "nope" }],
      },
    ]);
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const cache = yield* ComponentManifestCacheService;
        return yield* cache.getMany(["ready1", "err1", "missing"]);
      }).pipe(Effect.provide(ComponentManifestCacheService.layer.pipe(Layer.provide(layer)))),
    );
    expect(result.get("ready1")?.manifest).toEqual(readyManifest);
    expect(result.get("err1")?.status).toBe("error");
    expect(result.get("err1")?.manifest).toBeNull();
    expect(result.has("missing")).toBe(false);
  });
});
