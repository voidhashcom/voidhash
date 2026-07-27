import type { Primitive } from "@voidhash/mimic-core";
import {
  PathNode,
  ScreenNode,
  ShapeNode,
  TextNode,
  ViewNode,
  type Variable,
  type VariableType,
  type variableTypeSchema,
} from "@voidhash/mimic-schema";

import { commander } from "../../designer-commander";
import {
  findStatefulNode,
  findTypedNode,
  type DesignerDocumentRoot,
} from "../../utils/node-proxies";
import { replayableVariableValue } from "../../utils/replay";
import type { VariableTypeKey } from "../core";
import type { StatefulEditableNodeType } from "../node-resolver";

/**
 * Variable ids passed into these actions are array-ENTRY ids (the
 * `{id, pos, value}` wrapper ids the snapshot exposes), not the elements'
 * own `id` fields — the UI iterates entries, and entry handles are addressed
 * via `findById(entryId)`.
 */

type VariableValueInput = NonNullable<Primitive.InferInput<typeof variableTypeSchema>>;

/** Fresh variable value for a type key (the schema fills in the default). */
function initialVariableValue(type: VariableTypeKey): VariableValueInput {
  switch (type) {
    case "string":
      return { key: "string" };
    case "number":
      return { key: "number" };
    case "boolean":
      return { key: "boolean" };
    case "product":
      return { key: "product" };
  }
}

/**
 * Adds a local variable to a stateful node. Returns the created array-entry
 * id (reported by `push`); undo removes that entry.
 */
export const addVariable = commander.undoableAction<
  {
    nodeId: string;
    nodeType: StatefulEditableNodeType;
    type: VariableTypeKey;
    name: string;
  },
  { variableId: string | null }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();

    const variableId = mimic.document.transaction((root) => {
      const proxy = findStatefulNode(root, params.nodeId, params.nodeType);
      if (!proxy) return null;

      const created = proxy.data.localVariables.push({
        id: `var-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: params.name,
        value: initialVariableValue(params.type),
      });
      return created.id;
    });

    return { variableId };
  },
  (ctx, params, result) => {
    const { variableId } = result;
    if (variableId === null) return;

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      const proxy = findStatefulNode(root, params.nodeId, params.nodeType);
      if (!proxy) return;
      proxy.data.localVariables.remove(variableId);
    });
  },
);

/**
 * Removes a local variable (by array-entry id), capturing its snapshot for
 * undo. Undo re-adds the variable under a fresh entry id.
 */
export const removeVariable = commander.undoableAction<
  {
    nodeId: string;
    nodeType: StatefulEditableNodeType;
    variableId: string;
  },
  { removedVariable: Variable | null }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();

    const removedVariable = mimic.document.transaction((root) => {
      const proxy = findStatefulNode(root, params.nodeId, params.nodeType);
      if (!proxy) return null;
      const entry = proxy.data.localVariables.findById(params.variableId);
      const snapshot = entry?.get();
      if (entry === undefined || snapshot === undefined) return null;
      entry.remove();
      return snapshot;
    });

    return { removedVariable: removedVariable ?? null };
  },
  (ctx, params, result) => {
    const { removedVariable } = result;
    if (removedVariable === null) return;

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      const proxy = findStatefulNode(root, params.nodeId, params.nodeType);
      if (!proxy) return;
      proxy.data.localVariables.push(removedVariable);
    });
  },
);

/**
 * Updates a local variable's name and/or value (by array-entry id) through
 * entry-addressed writes. Raw values the schema rejects are dropped without
 * throwing. Undo restores the previous values captured from the entry's
 * snapshot.
 */
export const updateVariable = commander.undoableAction<
  {
    nodeId: string;
    nodeType: StatefulEditableNodeType;
    variableId: string;
    newName?: string;
    newValue?: unknown;
  },
  { previousName: string | null; previousValue: VariableType | null }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();

    return mimic.document.transaction((root) => {
      const proxy = findStatefulNode(root, params.nodeId, params.nodeType);
      const entry = proxy?.data.localVariables.findById(params.variableId);
      const snapshot = entry?.get();
      if (!proxy || entry === undefined || snapshot === undefined) {
        return { previousName: null, previousValue: null };
      }

      if (params.newName !== undefined) {
        entry.value.name.set(params.newName);
      }
      const newValue =
        params.newValue !== undefined ? replayableVariableValue(params.newValue) : undefined;
      if (newValue !== undefined) {
        entry.value.value.set(newValue);
      }

      return {
        previousName: params.newName !== undefined ? snapshot.name : null,
        previousValue: newValue !== undefined ? snapshot.value : null,
      };
    });
  },
  (ctx, params, result) => {
    const { previousName, previousValue } = result;
    if (previousName === null && previousValue === null) {
      return;
    }

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      const proxy = findStatefulNode(root, params.nodeId, params.nodeType);
      const entry = proxy?.data.localVariables.findById(params.variableId);
      if (!proxy || entry === undefined) return;

      if (previousName !== null) {
        entry.value.name.set(previousName);
      }
      if (previousValue !== null) {
        entry.value.value.set(previousValue);
      }
    });
  },
);
