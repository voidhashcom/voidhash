import { MimicHostError } from "@voidhash/core/services/paywalls/MimicHost";
import { ConflictError, NotFoundError } from "@voidhash/mimic-server/effect";
import * as Effect from "effect/Effect";
import { describe, expect, test, vi } from "vitest";

import {
  ensureDocument,
  ensureProvisioned,
  isConflictError,
  isLoopbackUrl,
  isNotFoundError,
  MIMIC_DATABASE_NAME,
  MIMIC_PAYWALLS_COLLECTION_NAME,
  type MimicProvisioningOps,
  type PaywallDocumentOps,
  resolveMimicFetch,
  retryOnceOnStaleIds,
  schemaJsonEquals,
  stableJsonStringify,
  StaleProvisioningIdsError,
} from "./MimicHostLive.ts";

const conflict = new ConflictError({ code: "conflict", message: "already exists" });
const notFound = new NotFoundError({ code: "not_found", message: "missing" });

/** An engine failure carrying neither a conflict nor a not-found tag — only a message. */
const rawFailure = (message: string) => new MimicHostError({ cause: message, message });

const TARGET_SCHEMA = { kind: "tree", nodes: { root: { type: "root" } } };
const makeOps = (state: {
  databases: Array<{ id: string; name: string }>;
  collections: Array<{ id: string; name: string; schema: unknown }>;
}): { ops: MimicProvisioningOps } => {
  const ops: MimicProvisioningOps = {
    listCollections: () => Effect.sync(() => [...state.collections]),
    listDatabases: () => Effect.sync(() => [...state.databases]),
  };
  return { ops };
};

describe("stableJsonStringify / schemaJsonEquals", () => {
  test("is insensitive to object key order, recursively", () => {
    const left = { a: 1, nested: { x: [1, { p: true, q: false }], y: "s" } };
    const right = { nested: { y: "s", x: [1, { q: false, p: true }] }, a: 1 };
    expect(stableJsonStringify(left)).toBe(stableJsonStringify(right));
    expect(schemaJsonEquals(left, right)).toBe(true);
  });

  test("stays sensitive to array order and values", () => {
    expect(schemaJsonEquals({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
    expect(schemaJsonEquals({ a: 1 }, { a: 2 })).toBe(false);
    expect(schemaJsonEquals({ a: 1 }, { a: 1, b: 1 })).toBe(false);
  });
});

describe("error classification", () => {
  test("recognizes the engine's tagged errors", () => {
    expect(isConflictError(conflict)).toBe(true);
    expect(isNotFoundError(notFound)).toBe(true);
    expect(isConflictError(notFound)).toBe(false);
    expect(isNotFoundError(conflict)).toBe(false);
  });

  test("recognizes raced unique violations by message", () => {
    expect(isConflictError(rawFailure("Duplicate entry 'voidhash' for key 'name'"))).toBe(true);
    expect(isConflictError(rawFailure("connection reset"))).toBe(false);
  });
});

describe("ensureProvisioned", () => {
  test("resolves the registry-owned database and collection", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { ops } = makeOps({
          collections: [
            { id: "col_x", name: MIMIC_PAYWALLS_COLLECTION_NAME, schema: TARGET_SCHEMA },
          ],
          databases: [{ id: "db_x", name: MIMIC_DATABASE_NAME }],
        });
        const ids = yield* ensureProvisioned(ops);
        expect(ids).toEqual({ collectionId: "col_x", databaseId: "db_x" });
      }),
    ));

  test("fails when the registry database is missing", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { ops } = makeOps({
          collections: [],
          databases: [],
        });
        const failure = yield* Effect.flip(ensureProvisioned(ops));
        expect(failure._tag).toBe("MimicHostError");
        expect(failure.cause).toContain("registry database");
      }),
    ));

  test("fails when the registry collection is missing", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { ops } = makeOps({
          collections: [],
          databases: [{ id: "db_x", name: MIMIC_DATABASE_NAME }],
        });
        const failure = yield* Effect.flip(ensureProvisioned(ops));
        expect(failure._tag).toBe("MimicHostError");
        expect(failure.cause).toContain("registry collection");
      }),
    ));
});

describe("ensureDocument", () => {
  const makeDocOps = (behavior: {
    /** Outcome per get call: entry i fails call i+1; a missing entry succeeds. */
    getErrors?: ReadonlyArray<unknown>;
    createError?: unknown;
  }): { ops: PaywallDocumentOps; calls: { create: number; get: number } } => {
    const calls = { create: 0, get: 0 };
    const ops: PaywallDocumentOps = {
      createDocument: () =>
        Effect.suspend(() => {
          calls.create += 1;
          if (behavior.createError !== undefined) {
            return Effect.fail(behavior.createError);
          }
          return Effect.succeed({ id: "doc" });
        }),
      getDocument: () =>
        Effect.suspend(() => {
          const error = behavior.getErrors?.[calls.get];
          calls.get += 1;
          if (error !== undefined) {
            return Effect.fail(error);
          }
          return Effect.succeed({ id: "doc" });
        }),
    };
    return { calls, ops };
  };

  test("does not create when the document already exists", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { calls, ops } = makeDocOps({});
        yield* ensureDocument(ops, "paywall_1");
        expect(calls).toEqual({ create: 0, get: 1 });
      }),
    ));

  test("creates the document on NotFound", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { calls, ops } = makeDocOps({ getErrors: [notFound] });
        yield* ensureDocument(ops, "paywall_1");
        expect(calls).toEqual({ create: 1, get: 1 });
      }),
    ));

  test("treats a create conflict as success once the document reads back", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { calls, ops } = makeDocOps({ createError: conflict, getErrors: [notFound] });
        yield* ensureDocument(ops, "paywall_1");
        // The lost race is VERIFIED with a re-read, not assumed.
        expect(calls).toEqual({ create: 1, get: 2 });
      }),
    ));

  test("fails descriptively when create conflicts but the document stays unreadable", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        // The corrupt-index half-state: the id is reserved (create conflicts)
        // while every read reports NotFound — e.g. an index row orphaned by an
        // out-of-band collection deletion. Must NOT count as ensured.
        const { calls, ops } = makeDocOps({
          createError: conflict,
          getErrors: [notFound, notFound],
        });
        const failure = yield* Effect.flip(ensureDocument(ops, "paywall_1"));
        if (failure._tag !== "MimicHostError") {
          return yield* Effect.die(new Error(`expected a MimicHostError, got ${failure._tag}`));
        }
        expect(failure.message).toContain("cannot be read");
        expect(calls).toEqual({ create: 1, get: 2 });
      }),
    ));

  test("wraps non-conflict create failures into MimicHostError", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { ops } = makeDocOps({ createError: rawFailure("boom"), getErrors: [notFound] });
        const failure = yield* Effect.flip(ensureDocument(ops, "paywall_1"));
        if (failure._tag !== "MimicHostError") {
          return yield* Effect.die(new Error(`expected a MimicHostError, got ${failure._tag}`));
        }
        expect(failure.message).toContain("creating the paywall document");
      }),
    ));

  test("wraps non-NotFound get failures into MimicHostError", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { calls, ops } = makeDocOps({ getErrors: [rawFailure("transport down")] });
        const failure = yield* Effect.flip(ensureDocument(ops, "paywall_1"));
        if (failure._tag !== "MimicHostError") {
          return yield* Effect.die(new Error(`expected a MimicHostError, got ${failure._tag}`));
        }
        expect(failure.message).toContain("loading the paywall document");
        expect(calls.create).toBe(0);
      }),
    ));

  test("classifies a NotFound on create as stale provisioning ids", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { calls, ops } = makeDocOps({ createError: notFound, getErrors: [notFound] });
        const failure = yield* Effect.flip(ensureDocument(ops, "paywall_1"));
        if (failure._tag !== "StaleProvisioningIdsError") {
          return yield* Effect.die(
            new Error(`expected a StaleProvisioningIdsError, got ${failure._tag}`),
          );
        }
        expect(failure.hostError.message).toContain("creating the paywall document");
        expect(calls).toEqual({ create: 1, get: 1 });
      }),
    ));
});

describe("retryOnceOnStaleIds", () => {
  const staleFailure = () =>
    new StaleProvisioningIdsError(
      new MimicHostError({ cause: "missing", message: "collection is gone" }),
    );

  test("invalidates and retries once on a stale failure, then succeeds", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        let runs = 0;
        let invalidations = 0;
        const op = Effect.suspend(() => {
          runs += 1;
          if (runs === 1) {
            return Effect.fail(staleFailure());
          }
          return Effect.succeed("ok");
        });
        const result = yield* retryOnceOnStaleIds(op, () => {
          invalidations += 1;
        });
        expect(result).toBe("ok");
        expect(runs).toBe(2);
        expect(invalidations).toBe(1);
      }),
    ));

  test("a second stale failure surfaces as the plain host error", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        let runs = 0;
        let invalidations = 0;
        const op = Effect.suspend(() => {
          runs += 1;
          return Effect.fail(staleFailure());
        });
        const failure = yield* Effect.flip(
          retryOnceOnStaleIds(op, () => {
            invalidations += 1;
          }),
        );
        expect(failure._tag).toBe("MimicHostError");
        expect(failure.message).toBe("collection is gone");
        expect(runs).toBe(2);
        expect(invalidations).toBe(1);
      }),
    ));

  test("non-stale failures surface unchanged without invalidating", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        let invalidations = 0;
        const hostError = new MimicHostError({ cause: "boom", message: "listing failed" });
        const failure = yield* Effect.flip(
          retryOnceOnStaleIds(Effect.fail(hostError), () => {
            invalidations += 1;
          }),
        );
        expect(failure).toBe(hostError);
        expect(invalidations).toBe(0);
      }),
    ));
});

describe("isLoopbackUrl", () => {
  test("accepts loopback hosts in any port/path shape", () => {
    expect(isLoopbackUrl("http://localhost:1338")).toBe(true);
    expect(isLoopbackUrl("http://localhost")).toBe(true);
    expect(isLoopbackUrl("http://127.0.0.1:1338/path")).toBe(true);
    expect(isLoopbackUrl("http://127.9.8.7")).toBe(true);
    expect(isLoopbackUrl("http://0.0.0.0:1338")).toBe(true);
    expect(isLoopbackUrl("http://[::1]:1338")).toBe(true);
  });

  test("rejects deployed and malformed URLs", () => {
    expect(isLoopbackUrl("https://mimic-db.example.workers.dev")).toBe(false);
    expect(isLoopbackUrl("https://localhost.example.com")).toBe(false);
    expect(isLoopbackUrl("http://127.0.0.1.example.com")).toBe(false);
    expect(isLoopbackUrl("not a url")).toBe(false);
  });
});

describe("resolveMimicFetch", () => {
  test("loopback URLs use the global fetch even without a binding", () =>
    Effect.gen(function* () {
      const globalFetch = vi.fn(() => Effect.runPromise(Effect.sync(() => new Response("local"))));
      vi.stubGlobal("fetch", globalFetch);
      const fetchImpl = yield* resolveMimicFetch("http://localhost:1338", undefined);
      const response = yield* Effect.promise(() => fetchImpl("http://localhost:1338/health"));
      const body = yield* Effect.promise(() => response.text());
      expect(body).toBe("local");
      expect(globalFetch).toHaveBeenCalledTimes(1);
    }).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          vi.unstubAllGlobals();
        }),
      ),
      Effect.runPromise,
    ));

  test("deployed URLs route through the MIMIC_HOST service binding", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const hostFetch = vi.fn(() => Effect.runPromise(Effect.sync(() => new Response("bound"))));
        const fetchImpl = yield* resolveMimicFetch("https://mimic-db.example.workers.dev", {
          fetch: hostFetch,
        });
        const response = yield* Effect.promise(() =>
          fetchImpl("https://mimic-db.example.workers.dev/health"),
        );
        const body = yield* Effect.promise(() => response.text());
        expect(body).toBe("bound");
        expect(hostFetch).toHaveBeenCalledTimes(1);
      }),
    ));

  test("deployed URLs without the binding fail instead of falling back to public fetch", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const failure = yield* Effect.flip(
          resolveMimicFetch("https://mimic-db.example.workers.dev", undefined),
        );
        expect(failure._tag).toBe("MimicHostError");
        expect(failure.message).toContain("service binding is missing");
      }),
    ));
});
