// @vitest-environment jsdom

import { TextNode, ViewNode } from "@voidhash/mimic-schema";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vite-plus/test";

import { createOfflineDesignerDocument, seededIds } from "../../state/testing/offline-document";
import { createDesignerStore, PaywallStoreContext } from "../../state/designer-store";
import type { PaywallDesignerStoreType } from "../../state/designer-store";
import { Viewport } from "../viewport";
import { Selectable } from "./selectable";

// oxlint-disable-next-line effect/noTestLifecycleHooks -- React Testing Library's DOM teardown: `cleanup` must run between renders on the shared jsdom document, and the panel/store harness is created by plain React renders outside any Effect scope, so there is no Scope for Effect.acquireRelease to close.
afterEach(cleanup);

/** Inserts one absolutely positioned view under the seeded screen. */
function insertAbsoluteView(store: PaywallDesignerStoreType): string {
  const doc = store.getState().mimic.document;
  const { screenId } = seededIds(doc as never);
  let viewId = "";
  (doc as never as { transaction: (fn: (root: never) => void) => void }).transaction(
    (root: never) => {
      const screen = (root as { findByIdAcrossTree: (id: string) => unknown }).findByIdAcrossTree(
        screenId,
      );
      const view = (
        screen as {
          children: {
            insertLast: (v: unknown) => {
              id: string;
              as: (n: unknown) => { data: { style: { update: (s: unknown) => void } } };
            };
          };
        }
      ).children.insertLast({ type: "view" });
      viewId = view.id;
      view.as(ViewNode).data.style.update({ position: "absolute", left: 5, top: 5 });
    },
  );
  return viewId;
}

/** Inserts one absolutely positioned text node under the seeded screen. */
function insertAbsoluteText(store: PaywallDesignerStoreType): string {
  const doc = store.getState().mimic.document;
  const { screenId } = seededIds(doc as never);
  let textId = "";
  (doc as never as { transaction: (fn: (root: never) => void) => void }).transaction(
    (root: never) => {
      const screen = (root as { findByIdAcrossTree: (id: string) => unknown }).findByIdAcrossTree(
        screenId,
      );
      const text = (
        screen as {
          children: {
            insertLast: (v: unknown) => {
              id: string;
              as: (n: unknown) => { data: { style: { update: (s: unknown) => void } } };
            };
          };
        }
      ).children.insertLast({ type: "text" });
      textId = text.id;
      text.as(TextNode).data.style.update({ position: "absolute", left: 5, top: 5 });
    },
  );
  return textId;
}

/** Injects a self-presence selecting `nodeId` so `canSelectNode` permits the drag. */
function selectInPresence(store: PaywallDesignerStoreType, nodeId: string): void {
  act(() => {
    store.setState((state) => ({
      ...state,
      // The offline stub transport never echoes presence, so inject `self`
      // directly (only `selectedNodeIds` is read here) to mark the node
      // selectable; the fuller presence shape is irrelevant to the drag path.
      mimic: {
        ...state.mimic,
        presence: {
          self: {
            selectedNodeIds: [{ id: "e0", pos: "a0", value: nodeId }],
            user: { color: "#fff", name: "Tester" },
          },
        } as never,
      },
    }));
  });
}

/** Renders a single `Selectable` wrapping a plain div that spreads its handlers. */
function renderSelectable(store: PaywallDesignerStoreType, nodeId: string) {
  return render(
    <PaywallStoreContext.Provider value={store}>
      <Viewport>
        <Selectable nodeId={nodeId}>
          {(handlers) => <div data-testid="target" {...handlers} />}
        </Selectable>
      </Viewport>
    </PaywallStoreContext.Provider>,
  );
}

test("Selectable exposes the document node id on its rendered element", () => {
  const doc = createOfflineDesignerDocument();
  const store = createDesignerStore(doc as never);
  const viewId = insertAbsoluteView(store);
  const view = renderSelectable(store, viewId);

  expect(view.getByTestId("target").getAttribute("data-paywall-node-id")).toBe(viewId);
});

describe("Selectable — unmount mid-drag cleanup", () => {
  test("unmounting during a drag removes listeners, restores the cursor, and cancels the move", () => {
    const doc = createOfflineDesignerDocument();
    const store = createDesignerStore(doc as never);
    const viewId = insertAbsoluteView(store);
    selectInPresence(store, viewId);

    const view = renderSelectable(store, viewId);
    const target = view.getByTestId("target");

    // Press, then cross the 3px threshold so a draft-backed move starts.
    act(() => {
      fireEvent.mouseDown(target, { button: 0, clientX: 0, clientY: 0 });
    });
    act(() => {
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 20, clientY: 20 }));
    });

    expect(store.getState().move.isActive).toBe(true);
    expect(document.body.style.cursor).toBe("move");
    expect(store.getState()._commander.activeDraft).not.toBeNull();

    // Unmount mid-drag (e.g. the node was deleted by a collaborator).
    act(() => {
      view.unmount();
    });

    // Listeners + cursor + move state + draft are all torn down.
    expect(document.body.style.cursor).toBe("");
    expect(store.getState().move.isActive).toBe(false);
    expect(store.getState()._commander.activeDraft).toBeNull();

    // A stray document mousemove after unmount must not resurrect the move.
    act(() => {
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 60, clientY: 60 }));
    });
    expect(store.getState().move.isActive).toBe(false);
  });

  test("a completed drag (mouseup) leaves nothing to clean up on later unmount", () => {
    const doc = createOfflineDesignerDocument();
    const store = createDesignerStore(doc as never);
    const viewId = insertAbsoluteView(store);
    selectInPresence(store, viewId);

    const view = renderSelectable(store, viewId);
    const target = view.getByTestId("target");

    act(() => {
      fireEvent.mouseDown(target, { button: 0, clientX: 0, clientY: 0 });
    });
    act(() => {
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 20, clientY: 20 }));
    });
    act(() => {
      document.dispatchEvent(new MouseEvent("mouseup", { button: 0, clientX: 20, clientY: 20 }));
    });

    // Move committed and ended cleanly.
    expect(store.getState().move.isActive).toBe(false);
    expect(document.body.style.cursor).toBe("");

    // Unmount afterwards is a no-op for the gesture.
    act(() => {
      view.unmount();
    });
    expect(store.getState().move.isActive).toBe(false);
  });

  test("a non-primary mouseup does not end an in-flight drag", () => {
    const doc = createOfflineDesignerDocument();
    const store = createDesignerStore(doc as never);
    const viewId = insertAbsoluteView(store);
    selectInPresence(store, viewId);

    const view = renderSelectable(store, viewId);
    const target = view.getByTestId("target");

    act(() => {
      fireEvent.mouseDown(target, { button: 0, clientX: 0, clientY: 0 });
    });
    act(() => {
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 20, clientY: 20 }));
    });
    expect(store.getState().move.isActive).toBe(true);

    // A right-button release must be ignored — the drag stays live.
    act(() => {
      document.dispatchEvent(new MouseEvent("mouseup", { button: 2, clientX: 20, clientY: 20 }));
    });
    expect(store.getState().move.isActive).toBe(true);

    // Clean up: the primary release ends it.
    act(() => {
      document.dispatchEvent(new MouseEvent("mouseup", { button: 0, clientX: 20, clientY: 20 }));
    });
    expect(store.getState().move.isActive).toBe(false);
  });

  test("an absolute text node is draggable — crossing the threshold starts a move", () => {
    const doc = createOfflineDesignerDocument();
    const store = createDesignerStore(doc as never);
    const textId = insertAbsoluteText(store);
    selectInPresence(store, textId);

    const view = renderSelectable(store, textId);
    const target = view.getByTestId("target");

    act(() => {
      fireEvent.mouseDown(target, { button: 0, clientX: 0, clientY: 0 });
    });
    act(() => {
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 20, clientY: 20 }));
    });

    // The text node gate now permits the drag just like a view node.
    expect(store.getState().move.isActive).toBe(true);
    expect(store.getState().move.nodes[textId]).toBeDefined();
    expect(document.body.style.cursor).toBe("move");

    act(() => {
      document.dispatchEvent(new MouseEvent("mouseup", { button: 0, clientX: 20, clientY: 20 }));
    });
    expect(store.getState().move.isActive).toBe(false);
  });
});
