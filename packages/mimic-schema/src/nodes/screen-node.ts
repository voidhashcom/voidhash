import { constant } from "@voidhash/lib/lang";
import { Primitive } from "@voidhash/mimic-core";

import { createStateSchemaWithStyleOverrides } from "../states/index.ts";
import {
  alignItems,
  alignSelf,
  backgroundColor,
  backgroundEnabled,
  backgroundGradient,
  backgroundImage,
  backgroundType,
  borderBottomWidth,
  borderColor,
  borderEnabled,
  borderLeftWidth,
  borderRightWidth,
  borderStyle,
  borderTopWidth,
  display,
  flex,
  flexBasis,
  flexDirection,
  flexGrow,
  flexShrink,
  gap,
  justifyContent,
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
  safeAreaBottom,
  safeAreaTop,
  shadowColor,
  shadowEnabled,
  shadowOffsetX,
  shadowOffsetY,
  shadowOpacity,
  shadowRadius,
  x,
  y,
  zIndex,
} from "../styles/index.ts";
import { linkedVariables, localVariables } from "./base.ts";
import { ComponentNode } from "./component-node.ts";
import { ScrollViewNode } from "./scrollview-node.ts";
import { ShapeNode } from "./shape-node.ts";
import { TextNode } from "./text-node.ts";
import { ViewNode } from "./view-node.ts";

export const screenNodeStyleSchema = Primitive.Struct({
  // Position
  x,
  y,
  // Size
  width: Primitive.Number().default(375),
  height: Primitive.Number().default(812),
  minWidth,
  maxWidth,
  minHeight,
  maxHeight,
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
  // Background
  backgroundColor: backgroundColor.default("rgba(255, 255, 255, 1)"),
  backgroundEnabled: backgroundEnabled.default(true),
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
  // Visual
  opacity,
  overflow,
  zIndex,
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
  alignSelf,
}).default({});

export const screenNodeStateSchema = createStateSchemaWithStyleOverrides(
  screenNodeStyleSchema.partial({ stripDefaults: true }).default({}),
);

const screenNodeStates = Primitive.Array(screenNodeStateSchema).default([]);

// Per-locale background-image overrides — same whole-value shape and fall-back
// discipline as ViewNode's localized overrides.
export const screenNodeLocalizedSchema = Primitive.Array(
  Primitive.Struct({
    locale: Primitive.String().required(),
    overrides: Primitive.Struct({
      backgroundImage,
    })
      .partial({ stripDefaults: true })
      .default({}),
  }),
).default([]);

/** ScreenNode tree node schema */
export const ScreenNode = Primitive.TreeNode("screen", {
  children: () => constant([ViewNode, ScrollViewNode, TextNode, ShapeNode, ComponentNode]),
  data: Primitive.Struct({
    linkedVariables,
    localVariables,
    localized: screenNodeLocalizedSchema,
    name: Primitive.String().default("Screen"),
    states: screenNodeStates,
    style: screenNodeStyleSchema,
  }).required(),
});

export type ScreenNodeData = Primitive.TreeNodeSnapshot<typeof ScreenNode>;
