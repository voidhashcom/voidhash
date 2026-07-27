import type { ComponentBoundAction } from "@voidhash/mimic-schema";

import { commander } from "../../designer-commander";
import {
  type ComponentScalarValues,
  removeComponentActionEntry,
  removeComponentPropEntries,
  removeComponentPropEntry,
  restoreComponentActionBindings,
  restoreComponentNodeScalars,
  restoreComponentPropBindings,
  updateComponentNodeData,
  writeComponentActionBinding,
  writeComponentPropBinding,
} from "../../utils/component-node-writes";
import type { ComponentPropBindingPlain } from "../../utils/component-prop-values";

/**
 * Sets a component prop binding by prop name: updates the existing prop entry
 * (located from raw node state — proxy array reads resolve empty below tree
 * nodes) or adds a new `{name, value}` entry via a whole-array rebuild. Undo
 * restores the previous raw stored value — even when it no longer parses — or
 * removes the added entry.
 */
export const updateComponentPropBinding = commander.undoableAction<
  {
    nodeId: string;
    propName: string;
    binding: ComponentPropBindingPlain;
  },
  { previous: { existed: boolean; raw: unknown } | null }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();
    const result = mimic.document.transaction((root) =>
      writeComponentPropBinding(root, params.nodeId, params.propName, params.binding),
    );
    return {
      previous:
        result === undefined ? null : { existed: result.existed, raw: result.previousRaw },
    };
  },
  (ctx, params, result) => {
    const { previous } = result;
    if (previous === null) return;

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      if (!previous.existed) {
        removeComponentPropEntry(root, params.nodeId, params.propName);
        return;
      }
      restoreComponentPropBindings(root, params.nodeId, [
        { name: params.propName, raw: previous.raw },
      ]);
    });
  },
);

/** Per-node undo payload for a batched prop-binding write. */
interface NodePropWriteUndo {
  readonly nodeId: string;
  /** `null` when the node was not a component node (nothing was written). */
  readonly previous: { existed: boolean; raw: unknown } | null;
}

/**
 * Sets the SAME component prop binding on many nodes in ONE undoable action:
 * updates each node's existing prop entry or adds a new `{name, value}` entry,
 * all inside a single document transaction. Undo restores every node's prior
 * binding — removing the entry for nodes that had none before — so N nodes yield
 * exactly ONE undo entry. Mirrors {@link updateComponentPropBinding} per node.
 */
export const updateComponentPropBindingForNodes = commander.undoableAction<
  {
    nodeIds: readonly string[];
    propName: string;
    binding: ComponentPropBindingPlain;
  },
  { undo: readonly NodePropWriteUndo[] }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();
    const undo = mimic.document.transaction((root): NodePropWriteUndo[] =>
      params.nodeIds.map((nodeId) => {
        const result = writeComponentPropBinding(root, nodeId, params.propName, params.binding);
        return {
          nodeId,
          previous:
            result === undefined
              ? null
              : { existed: result.existed, raw: result.previousRaw },
        };
      }),
    );
    return { undo };
  },
  (ctx, params, result) => {
    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      for (const entry of result.undo) {
        if (entry.previous === null) continue;
        if (!entry.previous.existed) {
          removeComponentPropEntry(root, entry.nodeId, params.propName);
          continue;
        }
        restoreComponentPropBindings(root, entry.nodeId, [
          { name: params.propName, raw: entry.previous.raw },
        ]);
      }
    });
  },
);

/** Per-node undo payload for a batched prop-entry removal. */
interface NodePropRemoveUndo {
  readonly nodeId: string;
  /** `false` when nothing was removed (node missing or had no entry). */
  readonly removed: boolean;
  readonly removedRaw: unknown;
}

/**
 * Removes the SAME stored prop entry from many nodes in ONE undoable action —
 * the batched revert-to-default affordance. Undo re-adds every entry that was
 * actually removed, from its raw stored value, in a single transaction (N nodes
 * → ONE undo entry). Mirrors {@link removeComponentProp} per node.
 */
export const removeComponentPropForNodes = commander.undoableAction<
  {
    nodeIds: readonly string[];
    propName: string;
  },
  { undo: readonly NodePropRemoveUndo[] }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();
    const undo = mimic.document.transaction((root): NodePropRemoveUndo[] =>
      params.nodeIds.map((nodeId) => {
        const result = removeComponentPropEntry(root, nodeId, params.propName);
        return result === undefined
          ? { nodeId, removed: false, removedRaw: undefined }
          : { nodeId, removed: result.removed, removedRaw: result.previousRaw };
      }),
    );
    return { undo };
  },
  (ctx, params, result) => {
    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      for (const entry of result.undo) {
        if (!entry.removed) continue;
        restoreComponentPropBindings(root, entry.nodeId, [
          { name: params.propName, raw: entry.removedRaw },
        ]);
      }
    });
  },
);

/**
 * Removes a component node's stored prop entry by name (the revert-to-default
 * affordance — the manifest default applies again once the entry is gone).
 * Undo restores the removed entry from its raw stored value.
 */
export const removeComponentProp = commander.undoableAction<
  {
    nodeId: string;
    propName: string;
  },
  { removed: boolean; removedRaw: unknown }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();
    const result = mimic.document.transaction((root) =>
      removeComponentPropEntry(root, params.nodeId, params.propName),
    );
    return result === undefined
      ? { removed: false, removedRaw: undefined }
      : { removed: result.removed, removedRaw: result.previousRaw };
  },
  (ctx, params, result) => {
    if (!result.removed) return;

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      restoreComponentPropBindings(root, params.nodeId, [
        { name: params.propName, raw: result.removedRaw },
      ]);
    });
  },
);

/**
 * Binds a named component action: updates the existing binding entry (located
 * from raw node state) or adds a new `{name, action}` entry via a whole-array
 * rebuild. Undo restores the previous raw stored value or removes the added
 * entry.
 */
export const setComponentActionBinding = commander.undoableAction<
  {
    nodeId: string;
    actionName: string;
    action: ComponentBoundAction;
  },
  { previous: { existed: boolean; raw: unknown } | null }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();
    const result = mimic.document.transaction((root) =>
      writeComponentActionBinding(root, params.nodeId, params.actionName, params.action),
    );
    return {
      previous:
        result === undefined ? null : { existed: result.existed, raw: result.previousRaw },
    };
  },
  (ctx, params, result) => {
    const { previous } = result;
    if (previous === null) return;

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      if (!previous.existed) {
        removeComponentActionEntry(root, params.nodeId, params.actionName);
        return;
      }
      restoreComponentActionBindings(root, params.nodeId, [
        { name: params.actionName, raw: previous.raw },
      ]);
    });
  },
);

/**
 * Removes a component node's stored action binding by name (the action falls
 * back to "none"). Undo restores the removed entry from its raw stored value.
 */
export const removeComponentActionBinding = commander.undoableAction<
  {
    nodeId: string;
    actionName: string;
  },
  { removed: boolean; removedRaw: unknown }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();
    const result = mimic.document.transaction((root) =>
      removeComponentActionEntry(root, params.nodeId, params.actionName),
    );
    return result === undefined
      ? { removed: false, removedRaw: undefined }
      : { removed: result.removed, removedRaw: result.previousRaw };
  },
  (ctx, params, result) => {
    if (!result.removed) return;

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      restoreComponentActionBindings(root, params.nodeId, [
        { name: params.actionName, raw: result.removedRaw },
      ]);
    });
  },
);

/**
 * Applies a component version update in one transaction: bumps the pinned
 * version/contentHash, removes prop entries the new manifest no longer
 * declares (located from raw node state), and resets `previewState` to
 * "default" when the persisted state is absent from the new version. Undo
 * restores the touched scalar fields and the dropped prop entries from their
 * raw stored values — including values that no longer parse — (re-added
 * entries are appended; entry order is not preserved).
 */
export const applyComponentVersionUpdate = commander.undoableAction<
  {
    nodeId: string;
    version: number;
    contentHash: string;
    dropPropNames: string[];
    resetPreviewState: boolean;
  },
  {
    previous: {
      scalars: ComponentScalarValues;
      removedProps: { name: string; raw: unknown }[];
    } | null;
  }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();
    return mimic.document.transaction((root) => {
      const scalars = updateComponentNodeData(
        root,
        params.nodeId,
        params.resetPreviewState
          ? {
              componentVersion: params.version,
              contentHash: params.contentHash,
              previewState: "default",
            }
          : { componentVersion: params.version, contentHash: params.contentHash },
      );
      if (scalars === undefined) {
        return { previous: null };
      }
      const removedProps = removeComponentPropEntries(root, params.nodeId, params.dropPropNames);
      return { previous: { removedProps, scalars } };
    });
  },
  (ctx, params, result) => {
    const { previous } = result;
    if (previous === null) return;

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      restoreComponentNodeScalars(root, params.nodeId, previous.scalars);
      restoreComponentPropBindings(root, params.nodeId, previous.removedProps);
    });
  },
);
