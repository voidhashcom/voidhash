import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { DocumentSnapshotResponseSchema, TransactionEnvelopeSchema } from "../../src/rpc/index.js";

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
