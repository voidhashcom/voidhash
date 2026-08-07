import {
  PathNode,
  ScreenNode,
  ScrollViewNode,
  ShapeNode,
  TextNode,
  ViewNode,
} from "@voidhash/mimic-schema";

import { commander } from "../../designer-commander";
import {
  findStatefulNode,
  findTypedNode,
  type DesignerDocumentRoot,
} from "../../utils/node-proxies";
import {
  dnfInputFromSnapshot,
  replayableElementInput,
  unwrapEntriesDeep,
  type DnfInput,
} from "../../utils/replay";
import { clearSelectedStateIfDeleted } from "../../utils/state-overrides";
import type { StatefulEditableNodeType } from "../node-resolver";

/**
 * State ids passed into these actions are array-ENTRY ids (the
 * `{id, pos, value}` wrapper ids the snapshot exposes), not the elements'
 * own `id` fields — the UI iterates entries, and entry handles are addressed
 * via `findById(entryId)`.
 */

/**
 * Re-adds a removed state element from its captured snapshot (undo path):
 * the snapshot is unwrapped to input shape and validated against the node
 * type's state schema — payloads the schema rejects are dropped without
 * throwing. Returns the fresh array-entry id, or `null`.
 */
function restoreStateEntry(
  root: DesignerDocumentRoot,
  nodeId: string,
  nodeType: StatefulEditableNodeType,
  raw: unknown,
): string | null {
  const plain = unwrapEntriesDeep(raw);
  switch (nodeType) {
    case "view": {
      const node = findTypedNode(root, nodeId, ViewNode);
      const element = ViewNode.data.fields.states.element;
      if (!node || !replayableElementInput(element, plain)) return null;
      return node.data.states.push(plain).id;
    }
    case "scrollView": {
      const node = findTypedNode(root, nodeId, ScrollViewNode);
      const element = ScrollViewNode.data.fields.states.element;
      if (!node || !replayableElementInput(element, plain)) return null;
      return node.data.states.push(plain).id;
    }
    case "screen": {
      const node = findTypedNode(root, nodeId, ScreenNode);
      const element = ScreenNode.data.fields.states.element;
      if (!node || !replayableElementInput(element, plain)) return null;
      return node.data.states.push(plain).id;
    }
    case "text": {
      const node = findTypedNode(root, nodeId, TextNode);
      const element = TextNode.data.fields.states.element;
      if (!node || !replayableElementInput(element, plain)) return null;
      return node.data.states.push(plain).id;
    }
    case "shape": {
      const node = findTypedNode(root, nodeId, ShapeNode);
      const element = ShapeNode.data.fields.states.element;
      if (!node || !replayableElementInput(element, plain)) return null;
      return node.data.states.push(plain).id;
    }
    case "path": {
      const node = findTypedNode(root, nodeId, PathNode);
      const element = PathNode.data.fields.states.element;
      if (!node || !replayableElementInput(element, plain)) return null;
      return node.data.states.push(plain).id;
    }
  }
}

/**
 * Adds a state to a stateful node. Returns the created array-entry id
 * (reported by `push`); undo removes that entry.
 */
export const addNodeState = commander.undoableAction<
  {
    nodeId: string;
    nodeType: StatefulEditableNodeType;
    name: string;
    condition: DnfInput;
  },
  { stateId: string | null }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();

    const stateId = mimic.document.transaction((root) => {
      const proxy = findStatefulNode(root, params.nodeId, params.nodeType);
      if (!proxy) return null;

      const created = proxy.data.states.push({
        condition: params.condition,
        id: `state-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: params.name,
      });
      return created.id;
    });

    return { stateId };
  },
  (ctx, params, result) => {
    const { stateId } = result;
    if (stateId === null) return;

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      const proxy = findStatefulNode(root, params.nodeId, params.nodeType);
      if (!proxy) return;
      proxy.data.states.remove(stateId);
    });
  },
);

/**
 * Removes a state (by array-entry id), capturing its snapshot for undo.
 * Undo re-adds the state — under a fresh entry id — and re-points a
 * selection that targeted the removed entry at the restored one.
 */
export const removeNodeState = commander.undoableAction<
  {
    nodeId: string;
    nodeType: StatefulEditableNodeType;
    stateId: string;
  },
  { previousSelectedStateId: string | null; removedState: unknown }
>(
  (ctx, params) => {
    const state = ctx.getState();
    const { mimic } = state;
    const previousSelectedStateId = state.stateOverrideSelection[params.nodeId] ?? null;

    const removedState = mimic.document.transaction((root): unknown => {
      const proxy = findStatefulNode(root, params.nodeId, params.nodeType);
      if (!proxy) return null;
      const entry = proxy.data.states.findById(params.stateId);
      const snapshot = entry?.get();
      if (entry === undefined || snapshot === undefined) return null;
      entry.remove();
      return snapshot;
    });

    const nextSelection = clearSelectedStateIfDeleted(
      state.stateOverrideSelection,
      params.nodeId,
      params.stateId,
    );

    if (nextSelection !== state.stateOverrideSelection) {
      ctx.setState({
        stateOverrideSelection: nextSelection,
      });
    }

    return {
      previousSelectedStateId,
      removedState: removedState ?? null,
    };
  },
  (ctx, params, result) => {
    const { previousSelectedStateId, removedState } = result;
    if (removedState === null) return;

    const { mimic } = ctx.getState();

    const restoredStateId = mimic.document.transaction((root) =>
      restoreStateEntry(root, params.nodeId, params.nodeType, removedState),
    );

    if (previousSelectedStateId === params.stateId && restoredStateId !== null) {
      ctx.setState({
        stateOverrideSelection: {
          ...ctx.getState().stateOverrideSelection,
          [params.nodeId]: restoredStateId,
        },
      });
    }
  },
);

/**
 * Updates a state's name and/or condition (by array-entry id) through
 * entry-addressed writes. Undo restores the previous values captured from
 * the entry's snapshot.
 */
export const updateNodeState = commander.undoableAction<
  {
    nodeId: string;
    nodeType: StatefulEditableNodeType;
    stateId: string;
    newName?: string;
    newCondition?: DnfInput;
  },
  { previousName: string | null; previousCondition: DnfInput | null }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();

    return mimic.document.transaction((root) => {
      const proxy = findStatefulNode(root, params.nodeId, params.nodeType);
      const entry = proxy?.data.states.findById(params.stateId);
      const snapshot = entry?.get();
      if (!proxy || entry === undefined || snapshot === undefined) {
        return { previousCondition: null, previousName: null };
      }

      if (params.newName !== undefined) {
        entry.value.name.set(params.newName);
      }
      if (params.newCondition !== undefined) {
        entry.value.condition.set(params.newCondition);
      }

      return {
        previousCondition:
          params.newCondition !== undefined ? dnfInputFromSnapshot(snapshot.condition) : null,
        previousName: params.newName !== undefined ? snapshot.name : null,
      };
    });
  },
  (ctx, params, result) => {
    const { previousCondition, previousName } = result;
    if (previousName === null && previousCondition === null) {
      return;
    }

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      const proxy = findStatefulNode(root, params.nodeId, params.nodeType);
      const entry = proxy?.data.states.findById(params.stateId);
      if (!proxy || entry === undefined) return;

      if (previousName !== null) {
        entry.value.name.set(previousName);
      }
      if (previousCondition !== null) {
        entry.value.condition.set(previousCondition);
      }
    });
  },
);
