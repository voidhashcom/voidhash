import { Primitive } from "@voidhash/mimic-core";

import { CodeComponentNode } from "./code-component-node.ts";

/**
 * LibraryNode — a singleton container hung off the document root that holds the
 * paywall's code-component *definitions* (`codeComponent` children). It is not
 * part of the visual tree: the canvas walks screens only, never the library.
 * Created lazily on first component creation; carries no data of its own.
 */
export const LibraryNode = Primitive.TreeNode("library", {
  children: () => [CodeComponentNode] as const,
  data: Primitive.Struct({}).required(),
});

export type LibraryNodeData = Primitive.TreeNodeSnapshot<typeof LibraryNode>;
