import { describe, expect, it } from "vitest";
import { Primitive, applyBatch } from "@voidhash/mimic-core";

import { createClientDocument } from "../../src/client/ClientDocument.js";
import { FakeTransport, TestPrimitive, makeValue } from "../helpers.js";

describe("ClientDocument", () => {
  it("sanitizes initial values against the primitive schema", () => {
    const transport = new FakeTransport();
    const document = createClientDocument({
      primitive: TestPrimitive,
      transport,
      initialValue: makeValue("Hello", undefined, { extra: makeValue("nested") }),
      initialVersion: 2,
    });

    expect(document.getSnapshot()).toEqual({
      title: "Hello",
      done: false,
    });
    expect(document.isReady()).toBe(true);
    expect(document.getServerVersion()).toBe(2);
  });

  it("queues optimistic command transactions and reconciles accepted broadcasts", async () => {
    const transport = new FakeTransport();
    const document = createClientDocument({
      primitive: TestPrimitive,
      transport,
      initialValue: makeValue("One"),
      initialVersion: 3,
    });

    await document.connect();
    transport.emit({
      type: "snapshot",
      value: makeValue("One"),
      version: 3,
    });

    document.transaction((root) => {
      root.title.set("Two");
    });

    expect(document.getSnapshot()).toEqual({
      title: "Two",
      done: false,
    });
    expect(document.getPendingCount()).toBe(1);
    expect(transport.submitted).toHaveLength(1);
    expect(transport.submitted[0]).toMatchObject({
      baseVersion: 3,
      commands: [
        {
          kind: "value.set",
        },
      ],
    });

    transport.emit({
      type: "transaction",
      transaction: transport.submitted[0]!,
      version: 4,
    });

    expect(document.getPendingCount()).toBe(0);
    expect(document.getServerVersion()).toBe(4);
    expect(document.getServerSnapshot()).toEqual({
      title: "Two",
      done: false,
    });
  });

  it("requests a resync when a pending transaction is rejected", async () => {
    const transport = new FakeTransport();
    const document = createClientDocument({
      primitive: TestPrimitive,
      transport,
      initialValue: makeValue("One"),
      initialVersion: 1,
    });

    await document.connect();
    transport.emit({
      type: "snapshot",
      value: makeValue("One"),
      version: 1,
    });

    document.transaction((root) => {
      root.title.set("Rejected");
    });

    const transactionId = transport.submitted[0]!.id;
    transport.emit({
      type: "error",
      transactionId,
      reason: "version_conflict",
    });

    expect(transport.snapshotRequests).toHaveLength(1);
  });

  it("does not poison the pending queue when a write fails validation", async () => {
    const transport = new FakeTransport();
    const document = createClientDocument({
      primitive: TestPrimitive,
      transport,
      initialValue: makeValue("One"),
      initialVersion: 1,
    });

    await document.connect();
    transport.emit({
      type: "snapshot",
      value: makeValue("One"),
      version: 1,
    });

    // `title` is required without a default; deleting it fails validation.
    // The widened type bypasses the compile-time rejection on purpose.
    const badPatch: { title?: string } = { title: undefined };
    expect(() => document.root.update(badPatch)).toThrow();

    // The bad transaction must not stick around.
    expect(document.getPendingCount()).toBe(0);
    expect(document.getSnapshot()).toEqual({ title: "One", done: false });

    // The next good write goes through and reconciles normally.
    document.transaction((root) => {
      root.title.set("Two");
    });
    expect(document.getSnapshot()).toEqual({ title: "Two", done: false });
    expect(document.getPendingCount()).toBe(1);
    expect(transport.submitted).toHaveLength(1);

    transport.emit({
      type: "transaction",
      transaction: transport.submitted[0]!,
      version: 2,
    });
    expect(document.getPendingCount()).toBe(0);
    expect(document.getServerSnapshot()).toEqual({ title: "Two", done: false });
  });

  it("drops a pending head that a reconnect snapshot already contains", async () => {
    const FileNode = Primitive.TreeNode("file", {
      data: Primitive.Struct({
        name: Primitive.String().required(),
      }),
      children: [],
    });
    const TreeDocument = Primitive.Tree({ root: FileNode });
    const emptyTree = TreeDocument.encode([]);

    const transport = new FakeTransport();
    const document = createClientDocument({
      primitive: TreeDocument,
      transport,
      initialValue: emptyTree,
      initialVersion: 1,
    });

    await document.connect();
    transport.emit({ type: "snapshot", value: emptyTree, version: 1 });

    document.transaction((root) => {
      root.children.insertLast({ type: "file", name: "notes.md" });
    });
    expect(document.getPendingCount()).toBe(1);
    expect(transport.submitted).toHaveLength(1);

    // Reconnect snapshot that already contains the accepted-but-unacked
    // insert: replaying the pending head would throw DuplicateTreeNodeId.
    const acceptedValue = applyBatch(emptyTree, transport.submitted[0]!.commands);
    expect(() => {
      transport.emit({ type: "snapshot", value: acceptedValue, version: 2 });
    }).not.toThrow();

    expect(document.getPendingCount()).toBe(0);
    expect(document.getServerVersion()).toBe(2);
    expect(document.isReady()).toBe(true);
    expect(document.getSnapshot()).toHaveLength(1);
    expect(document.getSnapshot()?.[0]?.data.name).toBe("notes.md");
  });
});
