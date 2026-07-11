import { Primitive } from "@voidhash/mimic-core";

import { createStateSchemaWithStyleOverrides } from "../states/index.ts";
import {
  alignSelf,
  display,
  flex,
  flexBasis,
  flexGrow,
  flexShrink,
  height,
  marginBottom,
  marginLeft,
  marginRight,
  marginTop,
  maxHeight,
  maxWidth,
  minHeight,
  minWidth,
  opacity,
  width,
} from "../styles/index.ts";
import { linkedVariables, localVariables } from "./base.ts";
import { PathNode } from "./path-node.ts";

// SVG preserveAspectRatio options
export const preserveAspectRatio = Primitive.Either(
  Primitive.Literal("none"),
  Primitive.Literal("xMidYMid meet"),
  Primitive.Literal("xMidYMid slice"),
).default("xMidYMid meet");

/** ViewBox schema for SVG coordinate system */
export const viewBox = Primitive.Struct({
  minX: Primitive.Number().default(0),
  minY: Primitive.Number().default(0),
  width: Primitive.Number().default(24),
  height: Primitive.Number().default(24),
}).default({});

export const shapeNodeStyleSchema = Primitive.Struct({
  // Dimensions
  width,
  height,
  minWidth,
  maxWidth,
  minHeight,
  maxHeight,
  // Margin
  marginTop,
  marginRight,
  marginBottom,
  marginLeft,
  // Visual
  opacity,
  display,
  // Flex child
  flex,
  flexGrow,
  flexShrink,
  flexBasis,
  alignSelf: alignSelf.default("auto"),
  // SVG scaling
  preserveAspectRatio,
}).default({});

export const shapeNodeStateSchema = createStateSchemaWithStyleOverrides(
  shapeNodeStyleSchema.partial({ stripDefaults: true }).default({}),
);

const shapeNodeStates = Primitive.Array(shapeNodeStateSchema).default([]);

/** ShapeNode tree node schema - container for SVG paths */
export const ShapeNode = Primitive.TreeNode("shape", {
  children: [PathNode] as const,
  data: Primitive.Struct({
    linkedVariables,
    localVariables,
    name: Primitive.String().default("Shape"),
    states: shapeNodeStates,
    // Original SVG source for reference — optional, absence means "not imported from SVG"
    svgSource: Primitive.String(),
    // SVG viewBox
    viewBox,
    style: shapeNodeStyleSchema,
  }).required(),
});

export type ShapeNodeData = Primitive.TreeNodeSnapshot<typeof ShapeNode>;
export type ShapeNodeUpdateValue = Primitive.InferUpdateInput<
  Primitive.InferTreeNodeData<typeof ShapeNode>
>;
