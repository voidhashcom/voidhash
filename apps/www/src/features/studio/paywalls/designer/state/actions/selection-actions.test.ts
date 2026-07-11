import { describe, expect, test, vi } from "vite-plus/test";

import { clearSelection, selectNode, unselectNode } from "./selection-actions";

interface PresenceSnapshotFixture {
  cursor?: { x: number; y: number };
  name?: string;
  selectedNodeIds: { id: string; pos: string; value: string }[];
  user: { color: string; name: string };
}

interface PresenceInputFixture {
  cursor?: { x: number; y: number };
  name?: string;
  selectedNodeIds?: readonly string[];
  user: { color: string; name: string };
}

type SelectionState = {
  highlightedNodeId: string | null;
  stateOverrideSelection: Record<string, string | null>;
  mimic: {
    snapshot: Array<{
      id: string;
      type: string;
      children: Array<{ id: string; type: string; children: unknown[] }>;
    }>;
    document: {
      presence: {
        self: () => PresenceSnapshotFixture;
        set: (value: PresenceInputFixture) => void;
      };
    };
  };
};

function presenceSnapshot(selectedNodeIds: string[]): PresenceSnapshotFixture {
  return {
    selectedNodeIds: selectedNodeIds.map((value, index) => ({
      id: `entry-${index}`,
      pos: `a${index}`,
      value,
    })),
    user: { color: "#fff", name: "Tester" },
  };
}

function createSelectionCtx(initial: {
  selectedNodeIds: string[];
  stateOverrideSelection: Record<string, string | null>;
}) {
  let presence = presenceSnapshot(initial.selectedNodeIds);
  let state: SelectionState = {
    highlightedNodeId: null,
    mimic: {
      document: {
        presence: {
          self: () => presence,
          set: (value) => {
            presence = presenceSnapshot([...(value.selectedNodeIds ?? [])]);
          },
        },
      },
      snapshot: [
        {
          children: [
            { children: [], id: "node-1", type: "view" },
            { children: [], id: "node-2", type: "view" },
          ],
          id: "root",
          type: "root",
        },
      ],
    },
    stateOverrideSelection: initial.stateOverrideSelection,
  };

  const ctx = {
    dispatch: vi.fn(() => () => undefined),
    getState: () => state,
    setState: (partial: Partial<SelectionState>) => {
      state = { ...state, ...partial };
    },
    transaction: vi.fn(),
  };

  return {
    ctx,
    getSelectedNodeIds: () => presence.selectedNodeIds.map((entry) => entry.value),
    getState: () => state,
  };
}

describe("selection actions", () => {
  test("single select does not reset per-node state selections", () => {
    const initialSelection = { "node-1": "state-1" };
    const { ctx, getState, getSelectedNodeIds } = createSelectionCtx({
      selectedNodeIds: ["node-1"],
      stateOverrideSelection: initialSelection,
    });

    selectNode.fn(ctx as never, { id: "node-2", many: false });

    expect(getSelectedNodeIds()).toEqual(["node-2"]);
    expect(getState().stateOverrideSelection).toEqual(initialSelection);
    expect(ctx.dispatch).not.toHaveBeenCalled();
  });

  test("multi-select does not reset per-node state selections", () => {
    const initialSelection = { "node-1": "state-1", "node-2": "state-2" };
    const { ctx, getState, getSelectedNodeIds } = createSelectionCtx({
      selectedNodeIds: ["node-1"],
      stateOverrideSelection: initialSelection,
    });

    selectNode.fn(ctx as never, { id: "node-2", many: true });

    expect(getSelectedNodeIds()).toEqual(["node-1", "node-2"]);
    expect(getState().stateOverrideSelection).toEqual(initialSelection);
    expect(ctx.dispatch).not.toHaveBeenCalled();
  });

  test("unselect and clear keep remembered per-node state selections", () => {
    const initialSelection = { "node-1": "state-1", "node-2": "state-2" };
    const { ctx, getState, getSelectedNodeIds } = createSelectionCtx({
      selectedNodeIds: ["node-1", "node-2"],
      stateOverrideSelection: initialSelection,
    });

    unselectNode.fn(ctx as never, { id: "node-1" });
    expect(getSelectedNodeIds()).toEqual(["node-2"]);
    expect(getState().stateOverrideSelection).toEqual(initialSelection);

    clearSelection.fn(ctx as never, undefined as never);
    expect(getSelectedNodeIds()).toEqual([]);
    expect(getState().stateOverrideSelection).toEqual(initialSelection);
    expect(ctx.dispatch).not.toHaveBeenCalled();
  });
});
