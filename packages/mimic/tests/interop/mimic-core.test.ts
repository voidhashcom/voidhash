import { applyBatch, validate } from "@voidhash/mimic-core";
import { describe, expect, it } from "vitest";

import { createClientDocument } from "../../src/client/ClientDocument.js";
import { FakeTransport, TestPrimitive, makeValue } from "../helpers.js";

describe("mimic-core interop", () => {
  it("emits command batches that replay through mimic-core", async () => {
    const transport = new FakeTransport();
    const initialValue = makeValue("One");
    const document = createClientDocument({
      primitive: TestPrimitive,
      transport,
      initialValue,
      initialVersion: 1,
    });

    await document.connect();
    transport.emit({
      type: "snapshot",
      value: initialValue,
      version: 1,
    });

    document.transaction((root) => {
      root.title.set("Two");
    });

    const envelope = transport.submitted[0]!;
    const nextValue = applyBatch(initialValue, envelope.commands);
    expect(validate(TestPrimitive.schema, nextValue)).toEqual(makeValue("Two", false));
    expect(document.getSnapshot()).toEqual({
      title: "Two",
      done: false,
    });
  });
});
