import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { HostServiceTag } from "../../src/app/hostService.ts";
import type { TransactionEnvelope } from "../../src/document/transaction.ts";
import { objectValue, runHost, runHostWithControl, stringValue, titleSchema } from "../helpers.ts";

describe("mimic-db host flow (durable-entity engine, in-memory)", () => {
  it("bootstraps the root user and authenticates", () =>
    runHost(
      Effect.gen(function* () {
        const host = yield* HostServiceTag;
        const user = yield* host.authenticateBasic("root", "password");
        expect(user.isSuperuser).toBe(true);
        expect(user.username).toBe("root");
      }),
    ));

  it("creates database → collection → document and reads it back", () =>
    runHost(
      Effect.gen(function* () {
        const host = yield* HostServiceTag;
        const db = yield* host.createDatabase("voidhash", "test");
        const collection = yield* host.createCollection(db.id, "paywalls", titleSchema);
        expect(collection.schemaVersion).toBe(1);

        const created = yield* host.createDocument(
          collection.id,
          "doc-1",
          objectValue({ title: stringValue("Hello") }),
        );
        expect(created.id).toBe("doc-1");
        expect(created.version).toBe(1);
        expect((created.value as any).fields.title.value).toBe("Hello");

        const fetched = yield* host.getDocument(collection.id, "doc-1");
        expect((fetched.value as any).fields.title.value).toBe("Hello");
        expect(fetched.version).toBe(1);
      }),
    ));

  it("re-registers a document id orphaned by an out-of-band collection deletion", () =>
    runHost(
      Effect.gen(function* () {
        const host = yield* HostServiceTag;
        const db = yield* host.createDatabase("voidhash", "test");
        const original = yield* host.createCollection(db.id, "paywalls", titleSchema);
        yield* host.createDocument(
          original.id,
          "doc-1",
          objectValue({ title: stringValue("Hello") }),
        );

        // Delete + recreate the collection WITHOUT deleting the document —
        // `deleteCollection` leaves the document_index row behind, pointing
        // at the dead collection. Before the prepareDocument fix this id was
        // permanently unusable: create conflicted (global id check) while
        // get reported NotFound (collection match), so a paywall could never
        // materialize again after a collection re-provision.
        yield* host.deleteCollection(original.id);
        const recreated = yield* host.createCollection(db.id, "paywalls", titleSchema);

        const created = yield* host.createDocument(
          recreated.id,
          "doc-1",
          objectValue({ title: stringValue("Fresh") }),
        );
        expect(created.id).toBe("doc-1");

        const fetched = yield* host.getDocument(recreated.id, "doc-1");
        expect((fetched.value as any).fields.title.value).toBe("Fresh");
      }),
    ));

  it("re-seeds a half-dead index row (live + same-collection, but no document state)", () =>
    runHostWithControl(({ host, control }) =>
      Effect.gen(function* () {
        const db = yield* host.createDatabase("voidhash", "test");
        const collection = yield* host.createCollection(db.id, "paywalls", titleSchema);

        // Reproduce the live-dev orphan: an index row that is live AND points
        // at the CURRENT collection, yet whose per-document object holds no
        // state (registered directly, never created). This is what strands a
        // paywall on the edit-token path — get reports NotFound while create
        // conflicts on the global id — so the designer can never open it. The
        // heal only fires because host.createDocument now probes the document
        // object's materialization before deferring to the index.
        yield* control.store.registerDocument("doc-1", collection.id);

        const getBefore = yield* Effect.result(host.getDocument(collection.id, "doc-1"));
        expect(Result.isFailure(getBefore)).toBe(true);

        const created = yield* host.createDocument(
          collection.id,
          "doc-1",
          objectValue({ title: stringValue("Fresh") }),
        );
        expect(created.id).toBe("doc-1");

        const fetched = yield* host.getDocument(collection.id, "doc-1");
        expect((fetched.value as any).fields.title.value).toBe("Fresh");
      }),
    ));

  it("still conflicts on a same-id create while the owning collection exists", () =>
    runHost(
      Effect.gen(function* () {
        const host = yield* HostServiceTag;
        const db = yield* host.createDatabase("voidhash", "test");
        const paywalls = yield* host.createCollection(db.id, "paywalls", titleSchema);
        const other = yield* host.createCollection(db.id, "other", titleSchema);
        yield* host.createDocument(
          paywalls.id,
          "doc-1",
          objectValue({ title: stringValue("Hello") }),
        );

        const sameCollection = yield* Effect.result(
          host.createDocument(paywalls.id, "doc-1", objectValue({ title: stringValue("Nope") })),
        );
        expect(Result.isFailure(sameCollection)).toBe(true);

        const otherCollection = yield* Effect.result(
          host.createDocument(other.id, "doc-1", objectValue({ title: stringValue("Nope") })),
        );
        expect(Result.isFailure(otherCollection)).toBe(true);
      }),
    ));

  it("applies a transaction and bumps the version", () =>
    runHost(
      Effect.gen(function* () {
        const host = yield* HostServiceTag;
        const db = yield* host.createDatabase("voidhash", "test");
        const collection = yield* host.createCollection(db.id, "paywalls", titleSchema);
        yield* host.createDocument(
          collection.id,
          "doc-1",
          objectValue({ title: stringValue("Hello") }),
        );

        const tx: TransactionEnvelope = {
          id: "tx-1",
          baseVersion: 1,
          commands: [
            { kind: "object.set", path: [], key: "title", value: stringValue("Updated") } as any,
          ],
        };
        const result = yield* host.submitTransaction(collection.id, "doc-1", tx);
        expect(result.accepted).toBe(true);
        expect(result.version).toBe(2);

        const fetched = yield* host.getDocument(collection.id, "doc-1");
        expect((fetched.value as any).fields.title.value).toBe("Updated");
        expect(fetched.version).toBe(2);
      }),
    ));

  it("opens, edits through, and closes a headless document connection", () =>
    runHost(
      Effect.gen(function* () {
        const host = yield* HostServiceTag;
        const db = yield* host.createDatabase("voidhash", "test");
        const collection = yield* host.createCollection(db.id, "paywalls", titleSchema);
        yield* host.createDocument(
          collection.id,
          "doc-1",
          objectValue({ title: stringValue("Hello") }),
        );

        const opened = yield* host.attachConnection(
          collection.id,
          "doc-1",
          "edit-1",
          "write",
          "agent-1",
          objectValue({ name: stringValue("Agent") }),
        );
        expect(opened.version).toBe(1);
        expect(opened.presences["edit-1"]?.userId).toBe("agent-1");

        const result = yield* host.submitConnectionTransaction(collection.id, "doc-1", "edit-1", {
          id: "tx-connected",
          baseVersion: 1,
          commands: [
            { kind: "object.set", path: [], key: "title", value: stringValue("Updated") } as any,
          ],
        });
        expect(result).toMatchObject({ accepted: true, version: 2 });

        const connected = yield* host.getConnectionDocument(collection.id, "doc-1", "edit-1");
        expect((connected.value as any).fields.title.value).toBe("Updated");

        yield* host.detachConnection(collection.id, "doc-1", "edit-1");
        expect((yield* host.getPresenceSnapshot(collection.id, "doc-1")).presences).toEqual({});
        const afterClose = yield* Effect.result(
          host.getConnectionDocument(collection.id, "doc-1", "edit-1"),
        );
        expect(Result.isFailure(afterClose)).toBe(true);
      }),
    ));

  it("rejects a transaction with a stale base version", () =>
    runHost(
      Effect.gen(function* () {
        const host = yield* HostServiceTag;
        const db = yield* host.createDatabase("voidhash", "test");
        const collection = yield* host.createCollection(db.id, "paywalls", titleSchema);
        yield* host.createDocument(
          collection.id,
          "doc-1",
          objectValue({ title: stringValue("Hello") }),
        );

        const tx: TransactionEnvelope = {
          id: "tx-stale",
          baseVersion: 99,
          commands: [
            { kind: "object.set", path: [], key: "title", value: stringValue("Nope") } as any,
          ],
        };
        const result = yield* host.submitTransaction(collection.id, "doc-1", tx);
        expect(result.accepted).toBe(false);
        expect(result.reason).toContain("Version conflict");
      }),
    ));

  it("mints and validates a single-use document token", () =>
    runHost(
      Effect.gen(function* () {
        const host = yield* HostServiceTag;
        const db = yield* host.createDatabase("voidhash", "test");
        const collection = yield* host.createCollection(db.id, "paywalls", titleSchema);
        yield* host.createDocument(
          collection.id,
          "doc-1",
          objectValue({ title: stringValue("Hello") }),
        );

        const { token } = yield* host.createDocumentAuthToken(collection.id, "doc-1", "write", []);
        const auth = yield* host.authenticateDocumentToken(token, collection.id, "doc-1", null);
        expect(auth.permission).toBe("write");

        // Single-use: the second validation must fail.
        const second = yield* Effect.result(
          host.authenticateDocumentToken(token, collection.id, "doc-1", null),
        );
        expect(Result.isFailure(second)).toBe(true);
      }),
    ));
});
