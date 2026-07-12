import { createStore } from "zustand/vanilla";
import { describe, expect, it } from "vitest";

import { createClientDocument } from "../../src/client/ClientDocument.js";
import { mimic } from "../../src/zustand/middleware.js";
import { FakeTransport, TestPrimitive, makeValue } from "../helpers.js";

describe("zustand middleware", () => {
  it("keeps the mimic slice in sync with document changes", () => {
    const transport = new FakeTransport();
    const document = createClientDocument({
      primitive: TestPrimitive,
      transport,
      initialValue: makeValue("One"),
      initialVersion: 1,
    });

    const store = createStore(
      mimic(
        document,
        () => ({
          local: true,
        }),
        { autoConnect: false },
      ),
    );

    expect(store.getState().mimic.snapshot).toEqual({
      title: "One",
      done: false,
    });

    document.transaction((root) => {
      root.title.set("Two");
    });

    expect(store.getState().mimic.snapshot).toEqual({
      title: "Two",
      done: false,
    });
    expect(store.getState().mimic.pendingCount).toBe(1);
  });
});
