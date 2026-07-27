import { Primitive } from "@voidhash/mimic-core";

import {
  componentBoundActionSchema,
  componentPropBindingSchema,
  componentPropValueSchema,
} from "../component-bindings/index.ts";
import { ScrollViewNode } from "./scrollview-node.ts";
import { ShapeNode } from "./shape-node.ts";
import { TextNode } from "./text-node.ts";
import { ViewNode } from "./view-node.ts";

const componentNodeData = Primitive.Struct({
  actionBindings: Primitive.Array(
    Primitive.Struct({
      action: componentBoundActionSchema.required(),
      name: Primitive.String().required(),
    }),
  ).default([]),
  /**
   * Where the component definition comes from. `"catalog"` (default) pins a
   * deployed artifact via `componentSlug`/`componentVersion`/`contentHash`.
   * `"local"` references an in-document code-component definition by
   * `componentPath` (matching the `codeComponent` node's `path`); the catalog
   * fields carry sentinels (`componentSlug: ""`, `componentVersion: 0`,
   * `contentHash: ""`). `"builtin"` resolves a first-party component that
   * ships with the renderer by its stable `componentSlug` — UNPINNED: builtin
   * instances leave `componentVersion`/`contentHash` at their sentinels and
   * the implementation evolves with renderer releases.
   */
  componentSource: Primitive.String().default("catalog"),
  /** Canonical document-relative path of the referenced local component (`components/<basename>.tsx`), empty for catalog/builtin instances. */
  componentPath: Primitive.String().default(""),
  /** Catalog slug, or the stable builtin slug when `componentSource: "builtin"` (`""` sentinel when local). */
  componentSlug: Primitive.String().default(""),
  /** Catalog artifact version (catalog instances only; `0` sentinel when local/builtin — builtins are unpinned). */
  componentVersion: Primitive.Number().default(0),
  /** Catalog artifact content hash (catalog instances only; `""` sentinel when local/builtin — builtins are unpinned). */
  contentHash: Primitive.String().default(""),
  name: Primitive.String().default("Component"),
  previewState: Primitive.String().default("default"),
  props: Primitive.Array(
    Primitive.Struct({
      name: Primitive.String().required(),
      value: componentPropBindingSchema.required(),
      /**
       * Per-locale overrides for a literal prop value. Each entry carries a full
       * `componentPropValue` (whole-value replacement). Only meaningful when
       * `value` is a literal binding; ignored for variable-reference bindings.
       */
      localizedValues: Primitive.Array(
        Primitive.Struct({
          locale: Primitive.String().required(),
          value: componentPropValueSchema.required(),
        }),
      ).default([]),
    }),
  ).default([]),
}).required();

/**
 * ComponentNode tree node schema — an instance of a deployed code component
 * pinned to an immutable artifact identity (`contentHash`), of an in-document
 * local component, or of an unpinned renderer builtin (see `componentSource`).
 * Tree children are the node's slot content. Component nodes carry no
 * style/states/localVariables/interactions: data flows in through `props` and
 * out through `actionBindings`.
 *
 * The explicit `TreeNodePrimitive` annotation breaks the mutual recursion with
 * `ViewNode` (TS7022/TS7023). It widens the inferred children type to
 * `AnyTreeNodePrimitive`, so downstream code must not rely on
 * `ComponentNodeData["children"]` element types — narrow via `AnyNodeData`
 * instead.
 */
export const ComponentNode: Primitive.TreeNodePrimitive<"component", typeof componentNodeData> =
  Primitive.TreeNode("component", {
    children: () => [ViewNode, ScrollViewNode, TextNode, ShapeNode, Primitive.TreeNodeSelf] as const,
    data: componentNodeData,
  });

export type ComponentNodeData = Primitive.TreeNodeSnapshot<typeof ComponentNode>;
