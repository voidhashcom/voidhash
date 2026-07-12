// @vitest-environment jsdom

import { renderHook, act } from "@testing-library/react";
import { create } from "zustand";
import { describe, expect, it } from "vitest";

import { createClientDocument } from "../../src/client/ClientDocument.js";
import {
  clearActiveDraft,
  createCommander,
  setActiveDraft,
} from "../../src/zustand-commander/commander.js";
import { useCommander, useUndoRedo } from "../../src/zustand-commander/hooks.js";
import { mimic } from "../../src/zustand/middleware.js";
import { FakeTransport, TestPrimitive, makeValue } from "../helpers.js";

describe("zustand commander hooks", () => {
  it("dispatches undoable commands and supports undo", () => {
    const transport = new FakeTransport();
    const document = createClientDocument({
      primitive: TestPrimitive,
      transport,
      initialValue: makeValue("One"),
      initialVersion: 1,
    });

    const commander = createCommander<object, typeof TestPrimitive>();
    const rename = commander.undoableAction<{ title: string }, { previous: string }>(
      (ctx, params) => {
        const previous = document.getSnapshot()?.title ?? "";
        ctx.root.title.set(params.title);
        return { previous };
      },
      (ctx, _params, result) => {
        ctx.root.title.set(result.previous);
      },
    );

    const useStore = create(
      commander.middleware(
        mimic(document, () => ({}), {
          autoConnect: false,
        }),
      ),
    );

    const { result: dispatchResult } = renderHook(() => useCommander(useStore));
    const { result: undoRedo } = renderHook(() => useUndoRedo(useStore));

    act(() => {
      dispatchResult.current(rename)({ title: "Two" });
    });

    expect(document.getSnapshot()).toEqual({
      title: "Two",
      done: false,
    });
    expect(undoRedo.current.canUndo).toBe(true);

    act(() => {
      undoRedo.current.undo();
    });

    expect(document.getSnapshot()).toEqual({
      title: "One",
      done: false,
    });
  });

  it("notifies subscribers on a draft dispatch without recording undo", () => {
    const transport = new FakeTransport();
    const document = createClientDocument({
      primitive: TestPrimitive,
      transport,
      initialValue: makeValue("One"),
      initialVersion: 1,
    });

    const commander = createCommander<object, typeof TestPrimitive>();
    const rename = commander.undoableAction<{ title: string }, { previous: string }>(
      (ctx, params) => {
        const previous = document.getSnapshot()?.title ?? "";
        ctx.root.title.set(params.title);
        return { previous };
      },
      (ctx, _params, result) => {
        ctx.root.title.set(result.previous);
      },
    );

    const useStore = create(
      commander.middleware(
        mimic(document, () => ({}), {
          autoConnect: false,
        }),
      ),
    );

    const { result: dispatchResult } = renderHook(() => useCommander(useStore));
    const { result: undoRedo } = renderHook(() => useUndoRedo(useStore));

    const draft = document.createDraft();
    act(() => {
      setActiveDraft(useStore, draft);
    });

    let notifications = 0;
    const unsubscribe = useStore.subscribe(() => {
      notifications += 1;
    });

    act(() => {
      dispatchResult.current(rename)({ title: "Two" });
    });
    unsubscribe();

    // The write lands in the draft, not the committed document.
    expect(document.getSnapshot()).toEqual({ title: "One", done: false });
    expect(draft.getSnapshot()).toEqual({ title: "Two", done: false });
    // Subscribers were still notified so a draft-aware preview re-renders...
    expect(notifications).toBeGreaterThan(0);
    // ...but no undo entry was recorded — the draft commits as one step.
    expect(undoRedo.current.canUndo).toBe(false);

    act(() => {
      clearActiveDraft(useStore);
      draft.commit();
    });

    expect(document.getSnapshot()).toEqual({ title: "Two", done: false });
  });

  it("refreshes the undo entry's inverse payload on redo", () => {
    const transport = new FakeTransport();
    const document = createClientDocument({
      primitive: TestPrimitive,
      transport,
      initialValue: makeValue("One"),
      initialVersion: 1,
    });

    const commander = createCommander<object, typeof TestPrimitive>();
    let runCounter = 0;
    const reverts: string[] = [];
    const stamp = commander.undoableAction<{ title: string }, { runId: string }>(
      (ctx, params) => {
        runCounter += 1;
        ctx.root.title.set(params.title);
        return { runId: `run-${runCounter}` };
      },
      (ctx, _params, result) => {
        reverts.push(result.runId);
        ctx.root.title.set("One");
      },
    );

    const useStore = create(
      commander.middleware(
        mimic(document, () => ({}), {
          autoConnect: false,
        }),
      ),
    );

    const { result: dispatchResult } = renderHook(() => useCommander(useStore));
    const { result: undoRedo } = renderHook(() => useUndoRedo(useStore));

    act(() => {
      dispatchResult.current(stamp)({ title: "Two" });
    });
    act(() => {
      undoRedo.current.undo();
    });
    act(() => {
      undoRedo.current.redo();
    });
    act(() => {
      undoRedo.current.undo();
    });

    expect(reverts).toEqual(["run-1", "run-2"]);
    expect(document.getSnapshot()).toEqual({
      title: "One",
      done: false,
    });
  });
});
