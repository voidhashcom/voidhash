import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import { constant } from "@voidhash/lib/lang";

export const NODE_TYPES = constant([
  "root",
  "screen",
  "view",
  "scrollView",
  "text",
  "shape",
  "path",
  "component",
  "library",
  "codeComponent",
]);

export type NodeType = (typeof NODE_TYPES)[number];

export const EDITABLE_NODE_TYPES = constant([
  "screen",
  "view",
  "scrollView",
  "text",
  "shape",
  "path",
  "component",
]);

export type EditableNodeType = (typeof EDITABLE_NODE_TYPES)[number];

/**
 * Editable node types carrying the generic stateful data fields
 * (`style`, `states`, `localVariables`). Component nodes are editable but
 * stateless (props in, actions out) — generic style/state/variable actions
 * must be typed over this subset.
 */
export const STATEFUL_NODE_TYPES = constant([
  "screen",
  "view",
  "scrollView",
  "text",
  "shape",
  "path",
]);

export type StatefulEditableNodeType = (typeof STATEFUL_NODE_TYPES)[number];

export const ALLOWED_CHILDREN_BY_NODE_TYPE: Record<NodeType, readonly NodeType[]> = {
  root: ["screen", "library"],
  screen: ["view", "scrollView", "text", "shape", "component"],
  view: ["view", "scrollView", "text", "shape", "component"],
  scrollView: ["view", "scrollView", "text", "shape", "component"],
  text: [],
  shape: ["path"],
  path: [],
  component: ["view", "scrollView", "text", "shape", "component"],
  library: ["codeComponent"],
  codeComponent: [],
};

export function isNodeType(type: string): type is NodeType {
  return NODE_TYPES.some((known) => known === type);
}

export function isEditableNodeType(type: string): type is EditableNodeType {
  return EDITABLE_NODE_TYPES.some((known) => known === type);
}

export function isStatefulNodeType(type: string): type is StatefulEditableNodeType {
  return STATEFUL_NODE_TYPES.some((known) => known === type);
}

// oxlint-disable-next-line typescript/no-redundant-type-constituents -- `string | NodeType` is deliberate: these accept unvalidated strings from documents and the wire, and the NodeType arm documents the intended domain for callers passing an already-narrowed value. Narrowing to `string` would silently accept anything at call sites.
export function canBeChildOf(childType: string | NodeType, parentType: string | NodeType): boolean {
  if (!isNodeType(childType) || !isNodeType(parentType)) {
    return false;
  }
  return ALLOWED_CHILDREN_BY_NODE_TYPE[parentType].includes(childType);
}

export function canHaveChildren(type: Option.Option<string>): boolean {
  return Option.exists(
    type,
    (value) =>
      isNodeType(value) && Arr.isReadonlyArrayNonEmpty(ALLOWED_CHILDREN_BY_NODE_TYPE[value]),
  );
}

/**
 * Node types that can host layout primitives created from context menu
 * (row, column, text). We intentionally exclude shape although it is a
 * container, because it should only contain path nodes. Component nodes
 * qualify at the type level only — actions must additionally gate on the
 * component manifest's `slot` flag.
 */
export function canCreateLayoutChildren(type: Option.Option<string>): boolean {
  return Option.exists(
    type,
    (value) =>
      value === "screen" || value === "view" || value === "scrollView" || value === "component",
  );
}
