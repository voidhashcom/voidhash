/**
 * Text node commands using zustand-commander.
 *
 * These commands manage text node creation and updates.
 * Uses undoable actions for undo/redo support.
 */

import type { Primitive } from '@voidhash/mimic';
import { TextNode } from '@voidhash/mimic-schema';
import { Schema } from 'effect';
import { commander } from '../../designer-commander';
import { selectNode } from '../selection-actions';
import { setActiveTool } from '../tools-actions';

// =============================================================================
// Text Node Commands
// =============================================================================

/**
 * Create a new text node.
 * Undoable: removes the node on undo.
 */
export const createTextNode = commander.undoableAction(
  Schema.Struct({
    parentId: Schema.String,
    beforeSiblingId: Schema.optional(Schema.NullOr(Schema.String)),
    initialValues: Schema.optional(Schema.Any)
  }),
  (ctx, params) => {
    const state = ctx.getState();
    const { mimic } = state;

    let newNodeId: string | undefined;

    mimic.document.transaction((root) => {
      // Create node with initial values
      const data = params.initialValues ?? {};
      newNodeId = root.insertLast(params.parentId, TextNode, data);
    });

    if (newNodeId) {
      // Select the new node and switch to cursor tool
      ctx.dispatch(selectNode)({ id: newNodeId, many: false });
      ctx.dispatch(setActiveTool)({ tool: 'cursor' });
    }

    return { nodeId: newNodeId ?? null };
  },
  (ctx, _params, result) => {
    if (result.nodeId === null) {
      return;
    }

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      root.remove(result.nodeId as string);
    });
  }
);

/**
 * Update an existing text node.
 * Undoable: restores the previous values on undo.
 */
export const updateTextNode = commander.undoableAction(
  Schema.Struct({
    id: Schema.String,
    updates: Schema.Unknown
  }),
  (ctx, params) => {
    const state = ctx.getState();
    const { mimic } = state;

    // Get the current node data for undo
    const node = mimic.document.root.node(params.id)?.as(TextNode);
    if (!node) {
      return { previousData: null };
    }

    // Store previous data for undo
    const previousData = { ...node.get().data };

    // Apply updates
    mimic.document.transaction((root) => {
      const proxy = root.node(params.id)?.as(TextNode);
      if (!proxy) {
        return;
      }

      // Apply each update field
      const updates = params.updates as Primitive.InferUpdateInput<
        typeof TextNode
      >;

      proxy.update(updates);
    });

    return { previousData };
  },
  (ctx, params, result) => {
    if (result.previousData === null) {
      return;
    }

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      const proxy = root.node(params.id)?.as(TextNode);
      if (!proxy) {
        return;
      }
      const prev = result.previousData as Record<string, unknown>;

      // Restore previous values
      if (prev.name && typeof prev.name === 'string') {
        proxy.data.name.set(prev.name);
      }

      if (prev.text && typeof prev.text === 'string') {
        proxy.data.text.set(prev.text);
      }

      if (prev.style && typeof prev.style === 'object') {
        const prevStyle = prev.style as Record<string, unknown>;
        for (const [key, value] of Object.entries(prevStyle)) {
          if (key in proxy.data.style && proxy.data.style[key]) {
            proxy.data.style[key].set(value);
          }
        }
      }
    });
  }
);

/**
 * Add a variable to a text node.
 */
export const addTextNodeVariable = commander.undoableAction(
  Schema.Struct({
    nodeId: Schema.String,
    type: Schema.Literal('string', 'number', 'boolean', 'product'),
    name: Schema.String
  }),
  (ctx, params) => {
    const { mimic } = ctx.getState();
    let variableId: string | null = null;

    mimic.document.transaction((root) => {
      const proxy = root.node(params.nodeId)?.as(TextNode);
      if (!proxy) {
        return;
      }
      // Generate a unique variable ID
      variableId = `var-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      proxy.data.localVariables.push({
        id: variableId,
        name: params.name,
        value: {
          key: params.type
        }
      });
    });

    return { variableId };
  },
  (ctx, params, result) => {
    const variableId = result.variableId;
    if (variableId === null) {
      return;
    }

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      const proxy = root.node(params.nodeId)?.as(TextNode);
      if (!proxy) {
        return;
      }
      proxy.data.localVariables.remove(variableId);
    });
  }
);

/**
 * Remove a variable from a text node.
 */
export const removeTextNodeVariable = commander.undoableAction(
  Schema.Struct({
    nodeId: Schema.String,
    variableId: Schema.String
  }),
  (ctx, params) => {
    const { mimic } = ctx.getState();

    // Get the variable data for undo
    const node = mimic.document.root.node(params.nodeId)?.as(TextNode);
    if (!node) {
      return { removedVariable: null };
    }
    const variable = node.data.localVariables.at(params.variableId);

    mimic.document.transaction((root) => {
      const proxy = root.node(params.nodeId)?.as(TextNode);
      if (!proxy) {
        return;
      }
      proxy.data.localVariables.remove(params.variableId);
    });

    return { removedVariable: variable?.get() ?? null };
  },
  (ctx, params, result) => {
    if (result.removedVariable === null) {
      return;
    }

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      const proxy = root.node(params.nodeId)?.as(TextNode);
      if (!(proxy && result.removedVariable)) {
        return;
      }
      proxy.data.localVariables.push(result.removedVariable);
    });
  }
);

/**
 * Update a variable on a text node.
 */
export const updateTextNodeVariable = commander.undoableAction(
  Schema.Struct({
    nodeId: Schema.String,
    variableId: Schema.String,
    newName: Schema.optional(Schema.String),
    newValue: Schema.optional(Schema.Any)
  }),
  (ctx, params) => {
    const { mimic } = ctx.getState();

    // Get the previous variable data for undo
    const node = mimic.document.root.node(params.nodeId)?.as(TextNode);
    if (!node) {
      return { previousName: null, previousValue: null };
    }
    const variable = node.data.localVariables.at(params.variableId);

    const previousName = variable?.name.get();
    const previousValue = variable?.value.get();

    mimic.document.transaction((root) => {
      const proxy = root.node(params.nodeId)?.as(TextNode);
      if (!proxy) {
        return;
      }
      const varProxy = proxy.data.localVariables.at(params.variableId);

      if (params.newName !== undefined) {
        varProxy.name.set(params.newName);
      }
      if (params.newValue !== undefined) {
        varProxy.value.set(params.newValue);
      }
    });

    return { previousName, previousValue };
  },
  (ctx, params, result) => {
    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      const proxy = root.node(params.nodeId)?.as(TextNode);
      if (!proxy) {
        return;
      }
      const varProxy = proxy.data.localVariables.at(params.variableId);
      if (!(varProxy && result.previousName && result.previousValue)) {
        return;
      }

      if (result.previousName !== undefined) {
        varProxy.name.set(result.previousName);
      }
      if (result.previousValue !== undefined) {
        varProxy.value.set(result.previousValue);
      }
    });
  }
);

/**
 * Add a state to a text node.
 */
export const addTextNodeState = commander.undoableAction(
  Schema.Struct({
    nodeId: Schema.String,
    name: Schema.String,
    condition: Schema.Any
  }),
  (ctx, params) => {
    const { mimic } = ctx.getState();
    let stateId: string | null = null;

    mimic.document.transaction((root) => {
      const proxy = root.node(params.nodeId)?.as(TextNode);
      if (!proxy) {
        return;
      }
      stateId = `state-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const newState = {
        id: stateId,
        name: params.name,
        condition: params.condition
      };

      proxy.data.states.push(newState);
    });

    return { stateId };
  },
  (ctx, params, result) => {
    const stateId = result.stateId;
    if (stateId === null) {
      return;
    }

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      const proxy = root.node(params.nodeId)?.as(TextNode);
      if (!proxy) {
        return;
      }
      proxy.data.states.remove(stateId);
    });
  }
);

/**
 * Remove a state from a text node.
 */
export const removeTextNodeState = commander.undoableAction(
  Schema.Struct({
    nodeId: Schema.String,
    stateId: Schema.String
  }),
  (ctx, params) => {
    const { mimic } = ctx.getState();

    // Get the state data for undo
    const node = mimic.document.root.node(params.nodeId)?.as(TextNode);
    if (!node) {
      return { removedState: null };
    }
    const state = node.data.states.at(params.stateId);

    mimic.document.transaction((root) => {
      const proxy = root.node(params.nodeId)?.as(TextNode);
      if (!proxy) {
        return;
      }
      proxy.data.states.remove(params.stateId);
    });

    return { removedState: state?.get() ?? null };
  },
  (ctx, params, result) => {
    if (result.removedState === null) {
      return;
    }

    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      const proxy = root.node(params.nodeId)?.as(TextNode);
      if (!proxy || result.removedState === null) {
        return;
      }
      proxy.data.states.push(result.removedState);
    });
  }
);

/**
 * Update a state on a text node.
 */
export const updateTextNodeState = commander.undoableAction(
  Schema.Struct({
    nodeId: Schema.String,
    stateId: Schema.String,
    newName: Schema.optional(Schema.String),
    newCondition: Schema.optional(Schema.Any)
  }),
  (ctx, params) => {
    const { mimic } = ctx.getState();

    // Get the previous state data for undo
    const node = mimic.document.root.node(params.nodeId)?.as(TextNode);
    if (!node) {
      return { previousName: null, previousCondition: null };
    }
    const state = node.data.states.at(params.stateId);

    const previousName = state?.name.get();
    const previousCondition = state?.condition.get();

    mimic.document.transaction((root) => {
      const proxy = root.node(params.nodeId)?.as(TextNode);
      if (!proxy) {
        return;
      }
      const stateProxy = proxy.data.states.at(params.stateId);

      if (params.newName !== undefined) {
        stateProxy.name.set(params.newName);
      }
      if (params.newCondition !== undefined) {
        stateProxy.condition.set(params.newCondition);
      }
    });

    return { previousName, previousCondition };
  },
  (ctx, params, result) => {
    const { mimic } = ctx.getState();
    mimic.document.transaction((root) => {
      const proxy = root.node(params.nodeId)?.as(TextNode);
      if (!proxy) {
        return;
      }
      const stateProxy = proxy.data.states.at(params.stateId);
      if (!(stateProxy && result.previousName && result.previousCondition)) {
        return;
      }

      if (result.previousName !== undefined) {
        stateProxy.name.set(result.previousName);
      }
      if (result.previousCondition !== undefined) {
        stateProxy.condition.set(result.previousCondition);
      }
    });
  }
);
