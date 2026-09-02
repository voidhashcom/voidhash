import { constant } from "@voidhash/lib/lang";
import { Primitive } from "@voidhash/mimic-core";

import { LibraryNode } from "./library-node.ts";
import { ScreenNode } from "./screen-node.ts";

/**
 * Document-wide localization config. `defaultLocale` is the implicit base locale
 * every node authors against; `locales` lists the ADDITIONAL enabled locales
 * (the default is never listed). All localized overrides fall back to the base
 * values when a locale carries no override, so an empty config is a no-op.
 */
export const localizationConfigSchema = Primitive.Struct({
  defaultLocale: Primitive.String().default("en"),
  locales: Primitive.Array(Primitive.Struct({ tag: Primitive.String().required() })).default([]),
}).default({});

/**
 * RootNode tree node schema - the document root. Contains the visual `screen`
 * subtree plus an optional singleton `library` node holding code-component
 * definitions (source only, never rendered on canvas).
 */
export const RootNode = Primitive.TreeNode("root", {
  children: () => constant([ScreenNode, LibraryNode]),
  data: Primitive.Struct({
    localization: localizationConfigSchema,
    name: Primitive.String(),
  }).required(),
});

export type RootNodeData = Primitive.TreeNodeSnapshot<typeof RootNode>;
