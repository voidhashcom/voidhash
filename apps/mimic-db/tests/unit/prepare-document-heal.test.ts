import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { makeControlEngine } from "../../src/core/control-engine.ts";
import { makeMemoryControlStore } from "../../src/core/memory-store.ts";
import { objectValue, stringValue, titleSchema } from "../helpers.ts";

/**
 * Builds a control engine over a fresh in-memory store with a `voidhash`
 * database and a `paywalls` collection, returning both the engine and the
 * collection id — the fixture every case here reproduces the orphan on.
 */
const setup = Effect.gen(function* () {
  const store = makeMemoryControlStore();
  const control = makeControlEngine(store);
  yield* control.ensureRootUser("root", "password");
  const db = yield* control.createDatabase("voidhash", "test");
  const collection = yield* control.createCollection(db.id, "paywalls", titleSchema);
  return { control, collectionId: collection.id };
});

const materialized = () => Effect.succeed(true);
const unmaterialized = () => Effect.succeed(false);

describe("prepareDocument heals a half-dead index entry", () => {
  it("re-registers a live same-collection index row whose document object holds no state", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { control, collectionId } = yield* setup;

        // Reproduce the live-dev orphan: an index row that is live
        // (deletedAt === null) AND points at the CURRENT collection, but whose
        // per-document object was never materialized (or lost its state). This
        // is what `deleteCollection`-then-reprovision leaves when the recreated
        // collection reuses nothing of the old document object — the pointer is
        // valid, the state is gone. A bare index-only conflict check would
        // reserve the id forever (create conflicts, get reports NotFound).
        yield* control.store.registerDocument("pw_orphan", collectionId);

        const prepared = yield* control.prepareDocument(
          collectionId,
          "pw_orphan",
          objectValue({ title: stringValue("Fresh") }),
          unmaterialized,
        );
        expect(prepared.documentId).toBe("pw_orphan");

        // The heal re-points the row at the current collection and clears
        // deleted_at, so the id is readable again.
        const index = yield* control.store.findDocumentIndex("pw_orphan");
        expect(index?.collectionId).toBe(collectionId);
        expect(index?.deletedAt).toBe(null);
      }),
    ));

  it("still conflicts when the document object is materialized", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { control, collectionId } = yield* setup;
        yield* control.store.registerDocument("pw_live", collectionId);

        const result = yield* Effect.result(
          control.prepareDocument(
            collectionId,
            "pw_live",
            objectValue({ title: stringValue("Nope") }),
            materialized,
          ),
        );
        expect(Result.isFailure(result)).toBe(true);
      }),
    ));

  it("still conflicts without a probe (index-only behaviour preserved)", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { control, collectionId } = yield* setup;
        yield* control.store.registerDocument("pw_live", collectionId);

        const result = yield* Effect.result(
          control.prepareDocument(
            collectionId,
            "pw_live",
            objectValue({ title: stringValue("Nope") }),
          ),
        );
        expect(Result.isFailure(result)).toBe(true);
      }),
    ));
});
