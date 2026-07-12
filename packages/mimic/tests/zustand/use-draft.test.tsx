// @vitest-environment jsdom

import { renderHook, act } from "@testing-library/react";
import { createStore } from "zustand/vanilla";
import { describe, expect, it } from "vitest";

import { createClientDocument } from "../../src/client/ClientDocument.js";
import { createCommander } from "../../src/zustand-commander/commander.js";
import { mimic } from "../../src/zustand/middleware.js";
import { useDraft } from "../../src/zustand/useDraft.js";
import { FakeTransport, TestPrimitive, makeValue } from "../helpers.js";

describe("useDraft", () => {
  it("manages draft lifecycle through zustand", () => {
    const transport = new FakeTransport();
    const document = createClientDocument({
      primitive: TestPrimitive,
      transport,
      initialValue: makeValue("One"),
      initialVersion: 1,
    });

    const commander = createCommander<object, typeof TestPrimitive>();
    const store = createStore(
      commander.middleware(
        mimic(document, () => ({}), {
          autoConnect: false,
        }),
      ),
    );

    const { result } = renderHook(() => useDraft(store));

    act(() => {
      result.current.begin();
    });
    expect(store.getState()._commander.activeDraft).not.toBeNull();

    act(() => {
      store.getState()._commander.activeDraft?.update((root) => {
        root.title.set("Draft");
      });
      result.current.commit();
    });

    expect(store.getState()._commander.activeDraft).toBeNull();
    expect(document.getSnapshot()).toEqual({
      title: "Draft",
      done: false,
    });
  });
});
