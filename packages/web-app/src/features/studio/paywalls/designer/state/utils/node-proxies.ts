import type { Primitive } from "@voidhash/mimic-core";
import {
  PathNode,
  ScreenNode,
  ScrollViewNode,
  ShapeNode,
  TextNode,
  ViewNode,
  type PaywallDesignerDocument,
  type StatefulEditableNodeType,
} from "@voidhash/mimic-schema";

/**
 * Designer document tree proxy, as passed to `document.transaction`
 * callbacks (and exposed as `document.root`).
 */
export type DesignerDocumentRoot = Primitive.InferProxy<typeof PaywallDesignerDocument>;

/**
 * Resolves a node anywhere in the tree to its typed proxy, or `undefined`
 * when the node does not exist or has a different type (`as` would throw on
 * a type mismatch; this is the non-throwing variant every action uses).
 */
export function findTypedNode<TNode extends Primitive.AnyTreeNodePrimitive>(
  root: DesignerDocumentRoot,
  nodeId: string,
  node: TNode,
): Primitive.TypedNodeProxy<TNode> | undefined {
  const found = root.findByIdAcrossTree(nodeId);
  if (found === undefined || found.type !== node.type) {
    return undefined;
  }
  return found.as(node);
}

/** Typed proxy union for the node types carrying the generic stateful data. */
export type StatefulNodeProxy =
  | Primitive.TypedNodeProxy<typeof ViewNode>
  | Primitive.TypedNodeProxy<typeof ScrollViewNode>
  | Primitive.TypedNodeProxy<typeof ScreenNode>
  | Primitive.TypedNodeProxy<typeof TextNode>
  | Primitive.TypedNodeProxy<typeof ShapeNode>
  | Primitive.TypedNodeProxy<typeof PathNode>;

/**
 * Resolves a stateful node (style/states/localVariables data) to its typed
 * proxy by its declared node type, or `undefined` when missing/mismatched.
 */
export function findStatefulNode(
  root: DesignerDocumentRoot,
  nodeId: string,
  nodeType: StatefulEditableNodeType,
): StatefulNodeProxy | undefined {
  switch (nodeType) {
    case "view":
      return findTypedNode(root, nodeId, ViewNode);
    case "scrollView":
      return findTypedNode(root, nodeId, ScrollViewNode);
    case "screen":
      return findTypedNode(root, nodeId, ScreenNode);
    case "text":
      return findTypedNode(root, nodeId, TextNode);
    case "shape":
      return findTypedNode(root, nodeId, ShapeNode);
    case "path":
      return findTypedNode(root, nodeId, PathNode);
  }
}
