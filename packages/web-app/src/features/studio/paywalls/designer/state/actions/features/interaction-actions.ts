import type { Primitive } from "@voidhash/mimic-core";
import type { Action, Interaction, Trigger } from "@voidhash/mimic-schema";
import { ViewNode } from "@voidhash/mimic-schema";

import { commander } from "../../designer-commander";
import { findTypedNode, type DesignerDocumentRoot } from "../../utils/node-proxies";
import { replayableAction } from "../../utils/replay";

type ViewNodeProxy = Primitive.TypedNodeProxy<typeof ViewNode>;

/**
 * Interaction and state ids passed into these actions are array-ENTRY ids
 * (the `{id, pos, value}` wrapper ids the snapshot exposes), not the
 * elements' own `id` fields — the UI iterates entries, and entry handles are
 * addressed via `findById(entryId)`.
 */
const viewNodeProxy = (root: DesignerDocumentRoot, nodeId: string): ViewNodeProxy | undefined =>
  findTypedNode(root, nodeId, ViewNode);

function isSameAction(left: Action, right: Action): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** A state's action override read from the overrides array. */
interface ActionOverrideEntry {
  /** Array-entry id, addressable via `findById`/`remove` on the overrides proxy. */
  entryId: string;
  /** Interaction array-entry id the override applies to. */
  interactionId: string;
  /** The stored action value. */
  action: Action;
}

/** Reads a state entry's `overrides.actions` entries through its handle. */
const readActionOverrideEntries = (
  node: ViewNodeProxy,
  stateEntryId: string,
): ActionOverrideEntry[] => {
  const stateEntry = node.data.states.findById(stateEntryId);
  if (stateEntry === undefined) {
    return [];
  }
  return (stateEntry.value.overrides.actions.get() ?? []).flatMap((entry) =>
    entry.value === undefined
      ? []
      : [
          {
            action: entry.value.action,
            entryId: entry.id,
            interactionId: entry.value.interactionId,
          },
        ],
  );
};

/**
 * Sets a state's action override for an interaction: updates the existing
 * entry in place through its handle, or appends a new one.
 */
const upsertActionOverride = (
  node: ViewNodeProxy,
  stateEntryId: string,
  interactionId: string,
  action: Action,
): void => {
  const stateEntry = node.data.states.findById(stateEntryId);
  if (stateEntry === undefined) {
    return;
  }
  const overridesProxy = stateEntry.value.overrides.actions;

  const existing = overridesProxy.find((entry) => entry.get()?.interactionId === interactionId);
  if (existing !== undefined) {
    existing.value.action.set(action);
    return;
  }
  overridesProxy.push({ action, interactionId });
};

const removeActionOverride = (
  node: ViewNodeProxy,
  stateEntryId: string,
  interactionId: string,
): void => {
  const stateEntry = node.data.states.findById(stateEntryId);
  if (stateEntry === undefined) {
    return;
  }
  stateEntry.value.overrides.actions
    .find((entry) => entry.get()?.interactionId === interactionId)
    ?.remove();
};

/**
 * Adds a click/none interaction to a view node. Returns the created
 * array-entry id (reported by `push`); undo removes that entry.
 */
export const addInteraction = commander.undoableAction<
  { nodeId: string },
  { interactionId: string | null }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();

    const interactionId = mimic.document.transaction((root) => {
      const node = viewNodeProxy(root, params.nodeId);
      if (!node) return null;

      const created = node.data.interactions.push({
        action: { type: "none" },
        id: `interaction-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        trigger: { type: "click" },
      });
      return created.id;
    });

    return { interactionId };
  },
  (ctx, params, result) => {
    const { interactionId } = result;
    if (interactionId === null) return;

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      viewNodeProxy(root, params.nodeId)?.data.interactions.remove(interactionId);
    });
  },
);

/**
 * Removes an interaction (by array-entry id) together with every state's
 * action override referencing it. Undo re-adds the interaction — under a
 * fresh entry id — and re-keys the restored overrides to that new id.
 */
export const removeInteraction = commander.undoableAction<
  {
    nodeId: string;
    interactionId: string;
  },
  {
    removedInteraction: Interaction | null;
    removedActionOverrides: Array<{ stateEntryId: string; raw: unknown }>;
  }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();

    return mimic.document.transaction((root) => {
      const node = viewNodeProxy(root, params.nodeId);
      const entry = node?.data.interactions.findById(params.interactionId);
      const interaction = entry?.get();
      if (!node || entry === undefined || interaction === undefined) {
        return { removedActionOverrides: [], removedInteraction: null };
      }

      const removedActionOverrides: Array<{ stateEntryId: string; raw: unknown }> = [];
      for (const stateEntry of node.data.states.get() ?? []) {
        const override = readActionOverrideEntries(node, stateEntry.id).find(
          (candidate) => candidate.interactionId === params.interactionId,
        );
        if (override === undefined) continue;
        removedActionOverrides.push({ raw: override.action, stateEntryId: stateEntry.id });
        removeActionOverride(node, stateEntry.id, params.interactionId);
      }

      entry.remove();
      return { removedActionOverrides, removedInteraction: interaction };
    });
  },
  (ctx, params, result) => {
    const { removedActionOverrides, removedInteraction } = result;
    if (removedInteraction === null) return;

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      const node = viewNodeProxy(root, params.nodeId);
      if (!node) return;

      const restored = node.data.interactions.push(removedInteraction);

      for (const removed of removedActionOverrides) {
        const action = replayableAction(removed.raw);
        if (action === undefined) continue;
        upsertActionOverride(node, removed.stateEntryId, restored.id, action);
      }
    });
  },
);

/**
 * Updates an interaction's trigger and/or action (by array-entry id) through
 * entry-addressed writes. Undo restores the previous values.
 */
export const updateInteraction = commander.undoableAction<
  {
    nodeId: string;
    interactionId: string;
    newTrigger?: Trigger;
    newAction?: Action;
  },
  { previousTrigger: Trigger | null; previousAction: Action | null }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();

    return mimic.document.transaction((root) => {
      const node = viewNodeProxy(root, params.nodeId);
      const entry = node?.data.interactions.findById(params.interactionId);
      const interaction = entry?.get();
      if (!node || entry === undefined || interaction === undefined) {
        return { previousAction: null, previousTrigger: null };
      }

      if (params.newTrigger) {
        entry.value.trigger.set(params.newTrigger);
      }
      if (params.newAction) {
        entry.value.action.set(params.newAction);
      }

      return {
        previousAction: params.newAction ? interaction.action : null,
        previousTrigger: params.newTrigger ? interaction.trigger : null,
      };
    });
  },
  (ctx, params, result) => {
    const { previousAction, previousTrigger } = result;
    if (previousAction === null && previousTrigger === null) return;

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      const node = viewNodeProxy(root, params.nodeId);
      const entry = node?.data.interactions.findById(params.interactionId);
      if (!node || entry === undefined) return;

      if (previousTrigger !== null) {
        entry.value.trigger.set(previousTrigger);
      }
      if (previousAction !== null) {
        entry.value.action.set(previousAction);
      }
    });
  },
);

/**
 * Sets (or clears, when the new action equals the interaction's base action)
 * a state's per-interaction action override. Ids are array-entry ids. Undo
 * removes a freshly added override or restores the previous value.
 */
export const updateInteractionActionOverride = commander.undoableAction<
  {
    nodeId: string;
    interactionId: string;
    stateId: string;
    newAction: Action;
  },
  { hadOverride: boolean; previousOverrideRaw: unknown }
>(
  (ctx, params) => {
    const { mimic } = ctx.getState();

    return mimic.document.transaction((root) => {
      const node = viewNodeProxy(root, params.nodeId);
      if (!node) {
        return { hadOverride: false, previousOverrideRaw: undefined };
      }
      const interaction = node.data.interactions.findById(params.interactionId)?.get();
      const stateEntry = node.data.states.findById(params.stateId);
      if (interaction === undefined || stateEntry === undefined) {
        return { hadOverride: false, previousOverrideRaw: undefined };
      }

      const existing = readActionOverrideEntries(node, params.stateId).find(
        (candidate) => candidate.interactionId === params.interactionId,
      );
      const shouldRemoveOverride = isSameAction(params.newAction, interaction.action);

      if (shouldRemoveOverride) {
        removeActionOverride(node, params.stateId, params.interactionId);
      } else {
        upsertActionOverride(node, params.stateId, params.interactionId, params.newAction);
      }

      return { hadOverride: existing !== undefined, previousOverrideRaw: existing?.action };
    });
  },
  (ctx, params, result) => {
    const { hadOverride, previousOverrideRaw } = result;

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      const node = viewNodeProxy(root, params.nodeId);
      if (!node) return;

      if (!hadOverride) {
        removeActionOverride(node, params.stateId, params.interactionId);
        return;
      }
      const action = replayableAction(previousOverrideRaw);
      if (action !== undefined) {
        upsertActionOverride(node, params.stateId, params.interactionId, action);
      }
    });
  },
);
