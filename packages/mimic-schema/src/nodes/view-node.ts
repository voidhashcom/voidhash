import { constant } from "@voidhash/lib/lang";
import { Primitive } from "@voidhash/mimic-core";

import { interactionsSchema } from "../interactions/index.ts";
import { createStateSchemaWithStyleAndActionOverrides } from "../states/index.ts";
import {
  alignItems,
  alignSelf,
  backgroundColor,
  backgroundEnabled,
  backgroundGradient,
  backgroundImage,
  backgroundType,
  borderBottomLeftRadius,
  borderBottomRightRadius,
  borderBottomWidth,
  borderColor,
  borderEnabled,
  borderLeftWidth,
  borderRightWidth,
  borderStyle,
  borderTopLeftRadius,
  borderTopRightRadius,
  borderTopWidth,
  bottom,
  display,
  flex,
  flexBasis,
  flexDirection,
  flexGrow,
  flexShrink,
  gap,
  height,
  justifyContent,
  left,
  marginBottom,
  marginLeft,
  marginRight,
  marginTop,
  maxHeight,
  maxWidth,
  minHeight,
  minWidth,
  opacity,
  overflow,
  paddingBottom,
  paddingLeft,
  paddingRight,
  paddingTop,
  position,
  right,
  safeAreaBottom,
  safeAreaTop,
  shadowColor,
  shadowEnabled,
  shadowOffsetX,
  shadowOffsetY,
  shadowOpacity,
  shadowRadius,
  top,
  width,
  zIndex,
} from "../styles/index.ts";
import { linkedVariables, localVariables } from "./base.ts";
import { ComponentNode } from "./component-node.ts";
import { ScrollViewNode } from "./scrollview-node.ts";
import { ShapeNode } from "./shape-node.ts";
import { TextNode } from "./text-node.ts";

export const viewNodeStyleSchema = Primitive.Struct({
  // Padding
  paddingTop,
  paddingRight,
  paddingBottom,
  paddingLeft,
  // Margin
  marginTop,
  marginRight,
  marginBottom,
  marginLeft,
  // Layout
  gap,
  justifyContent,
  alignItems,
  flexDirection,
  // Dimensions
  width,
  height,
  // Size constraints
  minWidth,
  maxWidth,
  minHeight,
  maxHeight,
  // Background
  backgroundColor,
  backgroundEnabled,
  backgroundType,
  backgroundGradient,
  backgroundImage,
  // Border
  borderTopWidth,
  borderRightWidth,
  borderBottomWidth,
  borderLeftWidth,
  borderColor,
  borderStyle,
  borderEnabled,
  // Border radius
  borderTopLeftRadius,
  borderTopRightRadius,
  borderBottomRightRadius,
  borderBottomLeftRadius,
  // Visual
  opacity,
  overflow,
  zIndex,
  // Position
  position,
  left,
  top,
  right,
  bottom,
  display,
  // Shadow
  shadowEnabled,
  shadowColor,
  shadowOffsetX,
  shadowOffsetY,
  shadowRadius,
  shadowOpacity,
  // Safe area
  safeAreaTop,
  safeAreaBottom,
  // Flex child
  flex,
  flexGrow,
  flexShrink,
  flexBasis,
  alignSelf: alignSelf.default("auto"),
}).default({});

export const viewNodeStateSchema = createStateSchemaWithStyleAndActionOverrides(
  viewNodeStyleSchema.partial({ stripDefaults: true }).default({}),
);

const viewNodeStates = Primitive.Array(viewNodeStateSchema).default([]);

// Per-locale background-image overrides. `backgroundImage` (url + resizeMode)
// travels as a whole value; `.partial({ stripDefaults: true })` drops its own
// default so an entry that omits it falls back to the base style rather than
// materializing an empty image.
export const viewNodeLocalizedSchema = Primitive.Array(
  Primitive.Struct({
    locale: Primitive.String().required(),
    overrides: Primitive.Struct({
      backgroundImage,
    })
      .partial({ stripDefaults: true })
      .default({}),
  }),
).default([]);

/** ViewNode tree node schema */
export const ViewNode = Primitive.TreeNode("view", {
  children: () =>
    constant([Primitive.TreeNodeSelf, ScrollViewNode, TextNode, ShapeNode, ComponentNode]),
  data: Primitive.Struct({
    interactions: interactionsSchema,
    linkedVariables,
    localVariables,
    localized: viewNodeLocalizedSchema,
    name: Primitive.String().default("View"),
    states: viewNodeStates,
    style: viewNodeStyleSchema,
  }).required(),
});

export type ViewNodeData = Primitive.TreeNodeSnapshot<typeof ViewNode>;
export type ViewNodeStateSnapshot = NonNullable<
  Primitive.InferSnapshot<typeof viewNodeStateSchema>
>;
export type ViewNodeUpdateValue = Primitive.InferUpdateInput<
  Primitive.InferTreeNodeData<typeof ViewNode>
>;
