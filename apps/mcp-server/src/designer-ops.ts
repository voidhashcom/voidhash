import {
  FlexNode,
  PathNode,
  ScreenNode,
  ShapeNode,
  TextNode,
} from "@voidhash/paywall-designer-schema";

import { AppError, normalizeUnknownError } from "./errors";

export interface DesignerDocumentLike {
  root: any;
  transaction: (callback: (root: any) => void) => void;
}

export type DesignerNodeType = "flex" | "path" | "screen" | "shape" | "text";

const NODE_PRIMITIVES: Record<DesignerNodeType, unknown> = {
  flex: FlexNode,
  path: PathNode,
  screen: ScreenNode,
  shape: ShapeNode,
  text: TextNode,
};

export interface DesignerSnapshotMetadata {
  changedNodeId: string | null;
  nodeCount: number;
  rootId: string | null;
  rootType: string | null;
}

export interface AddNodeInput {
  afterSiblingId?: string;
  beforeSiblingId?: string;
  initialValues?: Record<string, unknown>;
  nodeType: DesignerNodeType;
  parentId: string | null;
}

export interface MoveNodeInput {
  afterSiblingId?: string;
  beforeSiblingId?: string;
  newParentId?: string | null;
  nodeId: string;
  toIndex?: number;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const countNodes = (node: unknown): number => {
  if (!isObject(node)) {
    return 0;
  }

  const children = Array.isArray(node.children) ? node.children : [];
  return 1 + children.reduce((sum, child) => sum + countNodes(child), 0);
};

export const toSnapshotMetadata = (
  snapshot: unknown,
  changedNodeId: string | null,
): DesignerSnapshotMetadata => {
  if (!isObject(snapshot)) {
    return {
      changedNodeId,
      nodeCount: 0,
      rootId: null,
      rootType: null,
    };
  }

  const rootId = typeof snapshot.id === "string" ? snapshot.id : null;
  const rootType = typeof snapshot.type === "string" ? snapshot.type : null;

  return {
    changedNodeId,
    nodeCount: countNodes(snapshot),
    rootId,
    rootType,
  };
};

const ensureNodePrimitive = (nodeType: string) => {
  const primitive = NODE_PRIMITIVES[nodeType as DesignerNodeType];
  if (!primitive) {
    throw new AppError("VALIDATION_ERROR", `Unsupported node type: ${nodeType}`, {
      nodeType,
    });
  }
  return primitive;
};

const transactionWithValidation = (
  document: DesignerDocumentLike,
  callback: Parameters<DesignerDocumentLike["transaction"]>[0],
) => {
  try {
    document.transaction(callback);
  } catch (error) {
    throw new AppError("VALIDATION_ERROR", "Designer mutation failed", {
      cause: normalizeUnknownError(error),
    });
  }
};

export const addNode = (
  document: DesignerDocumentLike,
  input: AddNodeInput,
): string => {
  if (input.beforeSiblingId && input.afterSiblingId) {
    throw new AppError(
      "VALIDATION_ERROR",
      "beforeSiblingId and afterSiblingId are mutually exclusive",
    );
  }

  const primitive = NODE_PRIMITIVES[input.nodeType];
  const initialValues = input.initialValues ?? {};
  let createdNodeId = "";

  transactionWithValidation(document, (root) => {
    if (input.beforeSiblingId) {
      createdNodeId = root.insertBefore(input.beforeSiblingId, primitive, initialValues);
      return;
    }

    if (input.afterSiblingId) {
      createdNodeId = root.insertAfter(input.afterSiblingId, primitive, initialValues);
      return;
    }

    createdNodeId = root.insertLast(input.parentId, primitive, initialValues);
  });

  return createdNodeId;
};

export const updateNode = (
  document: DesignerDocumentLike,
  nodeId: string,
  updates: Record<string, unknown>,
): void => {
  transactionWithValidation(document, (root) => {
    const node = root.node(nodeId);
    if (!node) {
      throw new AppError("VALIDATION_ERROR", `Node not found: ${nodeId}`);
    }

    const primitive = ensureNodePrimitive(node.type);
    const proxy = node.as(primitive);
    proxy.update(updates);
  });
};

export const setNodeStyle = (
  document: DesignerDocumentLike,
  nodeId: string,
  styleUpdates: Record<string, unknown>,
): void => {
  updateNode(document, nodeId, { style: styleUpdates });
};

export const setTextContent = (
  document: DesignerDocumentLike,
  nodeId: string,
  text: string,
): void => {
  transactionWithValidation(document, (root) => {
    const node = root.node(nodeId);
    if (!node) {
      throw new AppError("VALIDATION_ERROR", `Node not found: ${nodeId}`);
    }

    if (node.type !== "text") {
      throw new AppError("VALIDATION_ERROR", "set_text is only valid for text nodes", {
        nodeId,
        nodeType: node.type,
      });
    }

    node.as(TextNode).data.text.set(text);
  });
};

export const removeNode = (
  document: DesignerDocumentLike,
  nodeId: string,
): void => {
  transactionWithValidation(document, (root) => {
    const node = root.node(nodeId);
    if (!node) {
      throw new AppError("VALIDATION_ERROR", `Node not found: ${nodeId}`);
    }

    root.remove(nodeId);
  });
};

export const moveNode = (
  document: DesignerDocumentLike,
  input: MoveNodeInput,
): void => {
  const modes = [
    input.toIndex !== undefined,
    Boolean(input.beforeSiblingId),
    Boolean(input.afterSiblingId),
  ].filter(Boolean).length;

  if (modes > 1) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Provide only one positioning mode: toIndex, beforeSiblingId, or afterSiblingId",
    );
  }

  transactionWithValidation(document, (root) => {
    const node = root.node(input.nodeId);
    if (!node) {
      throw new AppError("VALIDATION_ERROR", `Node not found: ${input.nodeId}`);
    }

    if (input.beforeSiblingId) {
      root.moveBefore(input.nodeId, input.beforeSiblingId);
      return;
    }

    if (input.afterSiblingId) {
      root.moveAfter(input.nodeId, input.afterSiblingId);
      return;
    }

    const currentParentId = node.get().parentId;
    const targetParentId =
      input.newParentId === undefined ? currentParentId : input.newParentId;

    root.move(input.nodeId, targetParentId, input.toIndex ?? 0);
  });
};
