import { describe, expect, it } from "vitest";

import { createClientDocument } from "../../src/client/ClientDocument.js";
import { FakeTransport, TestPrimitive, makeValue } from "../helpers.js";

describe("DraftHandle", () => {
  it("keeps draft-local preview state isolated until commit", () => {
    const transport = new FakeTransport();
    const document = createClientDocument({
      primitive: TestPrimitive,
      transport,
      initialValue: makeValue("Base"),
      initialVersion: 1,
    });

    const draft = document.createDraft();
    draft.update((root) => {
      root.title.set("Draft");
    });

    expect(draft.getSnapshot()).toEqual({
      title: "Draft",
      done: false,
    });
    expect(document.getSnapshot()).toEqual({
      title: "Base",
      done: false,
    });

    draft.commit();

    expect(document.getSnapshot()).toEqual({
      title: "Draft",
      done: false,
    });
    expect(document.getPendingCount()).toBe(1);
  });

  it("discard removes the draft without touching the document state", () => {
    const transport = new FakeTransport();
    const document = createClientDocument({
      primitive: TestPrimitive,
      transport,
      initialValue: makeValue("Base"),
      initialVersion: 1,
    });

    const draft = document.createDraft();
    draft.update((root) => {
      root.title.set("Draft");
    });
    draft.discard();

    expect(document.getSnapshot()).toEqual({
      title: "Base",
      done: false,
    });
    expect(document.getPendingCount()).toBe(0);
    expect(document.getActiveDraftIds()).toEqual([]);
  });

  it("returns a stable snapshot reference between edits", () => {
    const transport = new FakeTransport();
    const document = createClientDocument({
      primitive: TestPrimitive,
      transport,
      initialValue: makeValue("Base"),
      initialVersion: 1,
    });

    const draft = document.createDraft();

    // Repeated reads without an intervening edit must be referentially stable —
    // draft-aware selectors read this during render (useSyncExternalStore).
    const first = draft.getSnapshot();
    expect(draft.getSnapshot()).toBe(first);

    draft.update((root) => {
      root.title.set("Draft");
    });

    // A staged edit produces a fresh reference so subscribers re-render...
    const afterEdit = draft.getSnapshot();
    expect(afterEdit).not.toBe(first);
    expect(afterEdit).toEqual({ title: "Draft", done: false });
    // ...and stabilizes again until the next edit.
    expect(draft.getSnapshot()).toBe(afterEdit);
  });
});
