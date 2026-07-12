import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  DatabaseMigrationSchema,
  DocumentSnapshotResponseSchema,
  MigrationChangeSchema,
  TransactionEnvelopeSchema,
} from "../../src/rpc/index.js";

describe("schemas", () => {
  it("round-trips a TransactionEnvelope through encode/decode", () => {
    const envelope = {
      id: "tx-1",
      baseVersion: 7,
      commands: [
        { kind: "value.set", path: [], value: { hello: "world" } },
        { kind: "value.set", path: ["foo"], value: 42 },
      ],
      submittedAt: "2026-05-03T12:00:00.000Z",
      actor: { userId: "user-1", connectionId: "conn-1" },
    } as const;

    const encoded = Schema.encodeSync(TransactionEnvelopeSchema)(envelope);
    const decoded = Schema.decodeUnknownSync(TransactionEnvelopeSchema)(encoded);

    expect(decoded).toEqual(envelope);
  });

  it("round-trips both MigrationChange variants", () => {
    const create = {
      type: "create" as const,
      collection: "todos",
      schema: { kind: "object", fields: { title: { kind: "string", required: true } } },
      skipIfExists: true,
    };
    const update = {
      type: "update" as const,
      collection: "todos",
      schema: { kind: "object", fields: { title: { kind: "string", required: true } } },
      oldSchema: { kind: "object", fields: {} },
      dataMigrationSource: "globalThis.x = 1;",
    };

    expect(Schema.decodeUnknownSync(MigrationChangeSchema)(create)).toEqual(create);
    expect(Schema.decodeUnknownSync(MigrationChangeSchema)(update)).toEqual(update);
  });

  it("round-trips a DatabaseMigration with optional changes", () => {
    const migration = {
      version: 3,
      name: "add-slug",
      checksum: "abc",
      appliedAt: "2026-05-03T12:00:00.000Z",
      changes: [
        {
          type: "create" as const,
          collection: "todos",
          schema: { kind: "object", fields: {} },
        },
      ],
    };

    expect(Schema.decodeUnknownSync(DatabaseMigrationSchema)(migration)).toEqual(migration);
  });

  it("round-trips a DocumentSnapshot", () => {
    const snapshot = {
      id: "doc-1",
      collectionId: "col-1",
      value: { hello: "world", n: 42 },
      version: 5,
    };

    expect(Schema.decodeUnknownSync(DocumentSnapshotResponseSchema)(snapshot)).toEqual(snapshot);
  });
});
