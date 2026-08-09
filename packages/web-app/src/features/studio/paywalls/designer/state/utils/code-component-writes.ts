import type { Primitive } from "@voidhash/mimic-core";
import { CodeComponentNode, LibraryNode, type CodeComponentNodeData } from "@voidhash/mimic-schema";
import { Effect } from "effect";

import { findTypedNode, type DesignerDocumentRoot } from "./node-proxies";

type CodeComponentNodeProxy = Primitive.TypedNodeProxy<typeof CodeComponentNode>;
type LibraryNodeProxy = Primitive.TypedNodeProxy<typeof LibraryNode>;

/** Fields stored on a code-component definition node. */
export interface CodeComponentDefinitionInput {
  /** Canonical document-relative path (`components/<basename>.tsx`) — the identity. */
  path: string;
  source: string;
}

const codeComponentProxy = (
  root: DesignerDocumentRoot,
  nodeId: string,
): CodeComponentNodeProxy | undefined => findTypedNode(root, nodeId, CodeComponentNode);

/**
 * Finds the singleton `library` container under the document root, creating it
 * on first use. Returns `undefined` only when the root node is missing (never
 * happens behind the `mimic.isReady` gate).
 */
export function findOrCreateLibrary(root: DesignerDocumentRoot): LibraryNodeProxy | undefined {
  const rootNode = root.children.first();
  if (rootNode === undefined) {
    return undefined;
  }
  const existing = rootNode.children.find((child) => child.type === "library");
  if (existing !== undefined) {
    return existing.as(LibraryNode);
  }
  return rootNode.children.insertLast({ type: "library" }).as(LibraryNode);
}

/** Reads the existing code-component paths (for uniqueness checks). */
export function readCodeComponentPaths(root: DesignerDocumentRoot): string[] {
  const library = root.children.first()?.children.find((child) => child.type === "library");
  if (library === undefined) {
    return [];
  }
  return library
    .as(LibraryNode)
    .children.map((child) => child.get()?.data.path)
    .filter((path): path is string => path !== undefined);
}

/**
 * Inserts a code-component definition into the library. Returns the new node
 * id, or `null` when the insert is rejected (e.g. root missing).
 */
export function insertCodeComponent(
  root: DesignerDocumentRoot,
  data: CodeComponentDefinitionInput,
): string | null {
  const library = findOrCreateLibrary(root);
  if (library === undefined) {
    return null;
  }
  return Effect.runSync(
    Effect.try(() => library.children.insertLast({ type: "codeComponent", ...data }).id).pipe(
      Effect.orElseSucceed(() => null),
    ),
  );
}

/** Updates a definition's `source`, returning the previous value for undo. */
export function writeCodeComponentSource(
  root: DesignerDocumentRoot,
  nodeId: string,
  source: string,
): string | undefined {
  const node = codeComponentProxy(root, nodeId);
  if (node === undefined) {
    return undefined;
  }
  const previous = node.get()?.data.source;
  node.update({ source });
  return previous;
}

/** Updates a definition's `path`, returning the previous value for undo. */
export function writeCodeComponentPath(
  root: DesignerDocumentRoot,
  nodeId: string,
  path: string,
): string | undefined {
  const node = codeComponentProxy(root, nodeId);
  if (node === undefined) {
    return undefined;
  }
  const previous = node.get()?.data.path;
  node.update({ path });
  return previous;
}

/**
 * Removes a definition, returning its full snapshot (id + data) so undo can
 * re-insert it with the same id — keeping local instance references intact.
 */
export function removeCodeComponent(
  root: DesignerDocumentRoot,
  nodeId: string,
): CodeComponentNodeData | undefined {
  const node = codeComponentProxy(root, nodeId);
  if (node === undefined) {
    return undefined;
  }
  const snapshot = node.get();
  node.remove();
  return snapshot;
}

/** Re-inserts a previously removed definition with its original id (undo). */
export function restoreCodeComponent(
  root: DesignerDocumentRoot,
  snapshot: CodeComponentNodeData,
): void {
  const library = findOrCreateLibrary(root);
  library?.children.insertLast({
    type: "codeComponent",
    id: snapshot.id,
    path: snapshot.data.path,
    source: snapshot.data.source,
  });
}
