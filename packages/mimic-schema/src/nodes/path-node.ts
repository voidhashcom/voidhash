import { Primitive } from "@voidhash/mimic-core";

import { createStateSchemaWithStyleOverrides } from "../states/index.ts";
import {
  display,
  fillColor,
  fillEnabled,
  fillOpacity,
  fillRule,
  opacity,
  strokeColor,
  strokeEnabled,
  strokeLinecap,
  strokeLinejoin,
  strokeOpacity,
  strokeWidth,
} from "../styles/index.ts";
import { linkedVariables, localVariables } from "./base.ts";

export const pathNodeStyleSchema = Primitive.Struct({
  // Fill
  fillColor,
  fillEnabled,
  fillRule,
  fillOpacity,
  // Stroke
  strokeColor,
  strokeEnabled,
  strokeWidth,
  strokeOpacity,
  strokeLinecap,
  strokeLinejoin,
  // Visual
  opacity,
  display,
}).default({});

export const pathNodeStateSchema = createStateSchemaWithStyleOverrides(
  pathNodeStyleSchema.partial({ stripDefaults: true }).default({}),
);

const pathNodeStates = Primitive.Array(pathNodeStateSchema).default([]);

/** PathNode tree node schema - represents an SVG path element */
export const PathNode = Primitive.TreeNode("path", {
  children: [] as const,
  data: Primitive.Struct({
    linkedVariables,
    localVariables,
    name: Primitive.String().default("Path"),
    states: pathNodeStates,
    // Path data (d attribute)
    d: Primitive.String().default(""),
    // Pre-computed transform from group flattening — optional, absence means "no transform"
    transform: Primitive.String(),
    style: pathNodeStyleSchema,
  }).required(),
});

export type PathNodeData = Primitive.TreeNodeSnapshot<typeof PathNode>;
export type PathNodeUpdateValue = Primitive.InferUpdateInput<
  Primitive.InferTreeNodeData<typeof PathNode>
>;
