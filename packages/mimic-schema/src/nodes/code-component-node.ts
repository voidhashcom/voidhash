import { constant } from "@voidhash/lib/lang";
import { Primitive } from "@voidhash/mimic-core";

const codeComponentNodeData = Primitive.Struct({
  path: Primitive.String().required(),
  source: Primitive.String().default(""),
}).required();

/**
 * CodeComponentNode — a paywall-scoped code-component *definition*. It holds the
 * raw TSX `source` authored in the browser editor; the compiled artifact
 * (manifest + preview trees) is derived in-browser and kept out of the document
 * (it is large and would race under concurrent edits). Instances placed on the
 * canvas are ordinary `component` nodes carrying `componentSource: "local"` and
 * a `componentPath` matching this node's `path`.
 *
 * `path` is the component's IDENTITY — the canonical document-relative path
 * `components/<basename>.tsx` (the schema keeps it a permissive string; the
 * shape is enforced at write sites). `source` is a whole-value LWW register —
 * writes should be debounced. Definitions live under the singleton `library`
 * node; they have no children.
 */
export const CodeComponentNode = Primitive.TreeNode("codeComponent", {
  children: constant([]),
  data: codeComponentNodeData,
});

export type CodeComponentNodeData = Primitive.TreeNodeSnapshot<typeof CodeComponentNode>;
