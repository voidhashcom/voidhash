import type { Primitive } from "@voidhash/mimic-core";
import type { ComponentPropDefinition } from "@voidhash/core/services/paywallDeploys/PaywallDeployManifest";
import {
  ComponentNode,
  type componentBoundActionSchema,
  type componentPropBindingSchema,
} from "@voidhash/mimic-schema";

import {
  componentBoundActionFromRaw,
  componentPropBindingFromRaw,
  manifestDefaultPropValue,
} from "./component-prop-values";
import { findTypedNode, type DesignerDocumentRoot } from "./node-proxies";

export type { DesignerDocumentRoot } from "./node-proxies";

/** Set input accepted by component prop binding writes. */
export type ComponentPropBindingSetInput = NonNullable<
  Primitive.InferInput<typeof componentPropBindingSchema>
>;

/** Set input accepted by component action binding writes. */
export type ComponentBoundActionSetInput = NonNullable<
  Primitive.InferInput<typeof componentBoundActionSchema>
>;

type ComponentNodeDataPrimitive = Primitive.InferTreeNodeData<typeof ComponentNode>;

/** Partial component-node `update` input (scalar and array fields). */
export type ComponentNodeUpdates = Primitive.InferUpdateInput<ComponentNodeDataPrimitive>;

type ComponentNodeProxy = Primitive.TypedNodeProxy<typeof ComponentNode>;

type ComponentNodeDataSnapshot = NonNullable<Primitive.InferSnapshot<ComponentNodeDataPrimitive>>;

const COMPONENT_SCALAR_KEYS = [
  "componentSource",
  "componentPath",
  "componentSlug",
  "componentVersion",
  "contentHash",
  "name",
  "previewState",
] as const;

type ComponentScalarKey = (typeof COMPONENT_SCALAR_KEYS)[number];

/** Previous values of the scalar component-node fields an update touched. */
export type ComponentScalarValues = Partial<Pick<ComponentNodeDataSnapshot, ComponentScalarKey>>;

/** A named entry read from a component node's `props`/`actionBindings`. */
export interface RawNamedEntry {
  /** Array-entry id, addressable via `findById`/`remove` on the array proxy. */
  entryId: string;
  /** The element's `name` field. */
  name: string;
  /**
   * The stored binding value (`value`/`action` field) as a decoded snapshot.
   * Typed `unknown` because it travels through undo payloads; replay it via
   * the `componentPropBindingFromRaw`/`componentBoundActionFromRaw` guards.
   */
  raw: unknown;
}

interface RawNamedElementInput {
  name: string;
  raw: unknown;
}

const componentNodeProxy = (
  root: DesignerDocumentRoot,
  nodeId: string,
): ComponentNodeProxy | undefined => findTypedNode(root, nodeId, ComponentNode);

/**
 * Reads a component node's stored prop entries in position order. Returns an
 * empty list when the node does not exist or is not a component node.
 */
export const readComponentPropEntries = (
  root: DesignerDocumentRoot,
  nodeId: string,
): RawNamedEntry[] => {
  const node = componentNodeProxy(root, nodeId);
  if (node === undefined) {
    return [];
  }
  return (node.data.props.get() ?? []).flatMap((entry) =>
    entry.value === undefined
      ? []
      : [{ entryId: entry.id, name: entry.value.name, raw: entry.value.value }],
  );
};

/**
 * Reads a component node's stored action binding entries in position order.
 */
export const readComponentActionEntries = (
  root: DesignerDocumentRoot,
  nodeId: string,
): RawNamedEntry[] => {
  const node = componentNodeProxy(root, nodeId);
  if (node === undefined) {
    return [];
  }
  return (node.data.actionBindings.get() ?? []).flatMap((entry) =>
    entry.value === undefined
      ? []
      : [{ entryId: entry.id, name: entry.value.name, raw: entry.value.action }],
  );
};

/**
 * Narrows a raw stored prop binding value to the union set input,
 * normalizing entry-wrapped inner arrays to the plain input shape. Payloads
 * the schema does not recognize (unknown union variants, malformed shapes)
 * yield `undefined` and are dropped from writes/restores without throwing.
 */
export function replayablePropBinding(raw: unknown): ComponentPropBindingSetInput | undefined {
  return componentPropBindingFromRaw(raw);
}

/**
 * Narrows a raw stored bound action value to the union set input. Same drop
 * semantics as {@link replayablePropBinding}.
 */
export function replayableBoundAction(raw: unknown): ComponentBoundActionSetInput | undefined {
  return componentBoundActionFromRaw(raw);
}

/** Result of a find-or-create binding write, carrying the undo payload. */
export interface ComponentEntryWriteResult {
  /** Whether an entry with the name already existed (updated in place). */
  existed: boolean;
  /** The previous stored value (undefined for fresh entries). */
  previousRaw: unknown;
}

/**
 * Sets a component prop binding by name: updates the existing entry in place
 * through its entry handle, or appends a new `{name, value}` entry. Returns
 * the previous stored value for undo, or `undefined` when the node does not
 * exist or is not a component node.
 */
export const writeComponentPropBinding = (
  root: DesignerDocumentRoot,
  nodeId: string,
  propName: string,
  binding: ComponentPropBindingSetInput,
): ComponentEntryWriteResult | undefined => {
  const node = componentNodeProxy(root, nodeId);
  if (node === undefined) {
    return undefined;
  }

  const existing = node.data.props.find((entry) => entry.get()?.name === propName);
  if (existing !== undefined) {
    const previousRaw = existing.get()?.value;
    existing.value.value.set(binding);
    return { existed: true, previousRaw };
  }

  node.data.props.push({ name: propName, value: binding });
  return { existed: false, previousRaw: undefined };
};

/**
 * Sets a component action binding by name. Same write discipline as
 * {@link writeComponentPropBinding}, against `actionBindings`.
 */
export const writeComponentActionBinding = (
  root: DesignerDocumentRoot,
  nodeId: string,
  actionName: string,
  action: ComponentBoundActionSetInput,
): ComponentEntryWriteResult | undefined => {
  const node = componentNodeProxy(root, nodeId);
  if (node === undefined) {
    return undefined;
  }

  const existing = node.data.actionBindings.find((entry) => entry.get()?.name === actionName);
  if (existing !== undefined) {
    const previousRaw = existing.get()?.action;
    existing.value.action.set(action);
    return { existed: true, previousRaw };
  }

  node.data.actionBindings.push({ action, name: actionName });
  return { existed: false, previousRaw: undefined };
};

/** Result of an entry removal, carrying the undo payload. */
export interface ComponentEntryRemoveResult {
  /** Whether an entry with the name was found and removed. */
  removed: boolean;
  /** The removed stored value (undefined when nothing was removed). */
  previousRaw: unknown;
}

/**
 * Removes a component node's stored prop entry by name. Returns the removed
 * value for undo, or `undefined` when the node does not exist.
 */
export const removeComponentPropEntry = (
  root: DesignerDocumentRoot,
  nodeId: string,
  propName: string,
): ComponentEntryRemoveResult | undefined => {
  const node = componentNodeProxy(root, nodeId);
  if (node === undefined) {
    return undefined;
  }
  const existing = node.data.props.find((entry) => entry.get()?.name === propName);
  if (existing === undefined) {
    return { previousRaw: undefined, removed: false };
  }
  const previousRaw = existing.get()?.value;
  existing.remove();
  return { previousRaw, removed: true };
};

/**
 * Removes a component node's stored action binding entry by name. Same
 * mechanics as {@link removeComponentPropEntry}, against `actionBindings`.
 */
export const removeComponentActionEntry = (
  root: DesignerDocumentRoot,
  nodeId: string,
  actionName: string,
): ComponentEntryRemoveResult | undefined => {
  const node = componentNodeProxy(root, nodeId);
  if (node === undefined) {
    return undefined;
  }
  const existing = node.data.actionBindings.find((entry) => entry.get()?.name === actionName);
  if (existing === undefined) {
    return { previousRaw: undefined, removed: false };
  }
  const previousRaw = existing.get()?.action;
  existing.remove();
  return { previousRaw, removed: true };
};

/**
 * Removes all stored prop entries matching the given names. Returns the
 * removed entries' names and stored values so undo can restore them.
 */
export const removeComponentPropEntries = (
  root: DesignerDocumentRoot,
  nodeId: string,
  propNames: readonly string[],
): RawNamedElementInput[] => {
  const node = componentNodeProxy(root, nodeId);
  if (node === undefined) {
    return [];
  }
  const removed: RawNamedElementInput[] = [];
  for (const entry of node.data.props.filter((candidate) => {
    const name = candidate.get()?.name;
    return name !== undefined && propNames.includes(name);
  })) {
    const snapshot = entry.get();
    if (snapshot === undefined) {
      continue;
    }
    entry.remove();
    removed.push({ name: snapshot.name, raw: snapshot.value });
  }
  return removed;
};

/**
 * Restores prop bindings from stored values (undo paths). Entries still
 * present are updated in place; missing ones are re-appended (entry order is
 * not preserved). Values the schema does not recognize are dropped without
 * throwing — every reader already treats them as absent.
 */
export const restoreComponentPropBindings = (
  root: DesignerDocumentRoot,
  nodeId: string,
  restores: readonly RawNamedElementInput[],
): void => {
  const node = componentNodeProxy(root, nodeId);
  if (node === undefined) {
    return;
  }

  for (const restore of restores) {
    const binding = replayablePropBinding(restore.raw);
    if (binding === undefined) {
      continue;
    }
    const existing = node.data.props.find((entry) => entry.get()?.name === restore.name);
    if (existing !== undefined) {
      existing.value.value.set(binding);
    } else {
      node.data.props.push({ name: restore.name, value: binding });
    }
  }
};

/**
 * Restores action bindings from stored values (undo paths). Same mechanics
 * as {@link restoreComponentPropBindings}, against `actionBindings`.
 */
export const restoreComponentActionBindings = (
  root: DesignerDocumentRoot,
  nodeId: string,
  restores: readonly RawNamedElementInput[],
): void => {
  const node = componentNodeProxy(root, nodeId);
  if (node === undefined) {
    return;
  }

  for (const restore of restores) {
    const action = replayableBoundAction(restore.raw);
    if (action === undefined) {
      continue;
    }
    const existing = node.data.actionBindings.find((entry) => entry.get()?.name === restore.name);
    if (existing !== undefined) {
      existing.value.action.set(action);
    } else {
      node.data.actionBindings.push({ action, name: restore.name });
    }
  }
};

/**
 * Prefills a freshly inserted component node's props with the manifest
 * defaults the editor can store.
 */
export const prefillComponentDefaultProps = (
  root: DesignerDocumentRoot,
  nodeId: string,
  manifestProps: Readonly<Record<string, ComponentPropDefinition>>,
): void => {
  const node = componentNodeProxy(root, nodeId);
  if (node === undefined) {
    return;
  }

  for (const [propName, def] of Object.entries(manifestProps)) {
    const value = manifestDefaultPropValue(def);
    if (value === undefined) {
      continue;
    }
    node.data.props.push({ name: propName, value: { type: "literal", value } });
  }
};

/**
 * Prefills a freshly inserted BUILTIN component node's props from a
 * definition's `defaultProps` — pre-built `{name, binding}` entries that drop
 * straight into `props`. Unlike {@link prefillComponentDefaultProps} (which
 * derives literal values from a manifest's prop definitions), the bindings are
 * supplied ready-made by the builtin definition. Each binding is normalized
 * through {@link replayablePropBinding} (snapshot → set-input shape); any that
 * the schema does not recognize are dropped without throwing.
 */
export const prefillBuiltinDefaultProps = (
  root: DesignerDocumentRoot,
  nodeId: string,
  defaultProps: ReadonlyArray<{ readonly name: string; readonly value: unknown }>,
): void => {
  const node = componentNodeProxy(root, nodeId);
  if (node === undefined) {
    return;
  }
  for (const prop of defaultProps) {
    const binding = replayablePropBinding(prop.value);
    if (binding === undefined) {
      continue;
    }
    node.data.props.push({ name: prop.name, value: binding });
  }
};

/**
 * Applies a component-node `update` and captures the previous values of the
 * scalar fields it touches, for undo restore via
 * {@link restoreComponentNodeScalars}. Array fields (`props` and
 * `actionBindings`) are deliberately never captured: snapshot array entries
 * are `{id, pos, value}`-wrapped and must be restored through the dedicated
 * entry-addressed helpers instead of `update`. Returns `undefined` when the
 * node does not exist.
 */
export const updateComponentNodeData = (
  root: DesignerDocumentRoot,
  nodeId: string,
  updates: ComponentNodeUpdates,
): ComponentScalarValues | undefined => {
  const node = componentNodeProxy(root, nodeId);
  if (node === undefined) {
    return undefined;
  }
  const data = node.get()?.data;
  if (data === undefined) {
    return undefined;
  }

  const previousValues: ComponentScalarValues = {};
  const capture = <K extends ComponentScalarKey>(key: K): void => {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      previousValues[key] = data[key];
    }
  };
  for (const key of COMPONENT_SCALAR_KEYS) {
    capture(key);
  }
  node.update(updates);
  return previousValues;
};

/** Restores the scalar fields captured by {@link updateComponentNodeData}. */
export const restoreComponentNodeScalars = (
  root: DesignerDocumentRoot,
  nodeId: string,
  previousValues: ComponentScalarValues,
): void => {
  componentNodeProxy(root, nodeId)?.update(previousValues);
};
