import { Primitive, type Types } from "@voidhash/mimic";

import { createStateSchemaWithStyleOverrides } from "../states";
import {
  alignItems,
  alignSelf,
  backgroundColor,
  backgroundEnabled,
  borderColor,
  borderEnabled,
  borderStyle,
  borderWidthBottom,
  borderWidthLeft,
  borderWidthRight,
  borderWidthTop,
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
  shadowBlurRadius,
  shadowColor,
  shadowEnabled,
  shadowOffsetX,
  shadowOffsetY,
  shadowOpacity,
  x,
  y,
  zIndex,
} from "../styles";
import { linkedVariables, localVariables } from "./base";
import { FlexNode } from "./flex-node";
import { ShapeNode } from "./shape-node";
import { TextNode } from "./text-node";

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
  // Border
  borderWidthTop,
  borderWidthRight,
  borderWidthBottom,
  borderWidthLeft,
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
  shadowBlurRadius,
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
});

export const screenNodeStateSchema = createStateSchemaWithStyleOverrides(
  screenNodeStyleSchema.partial({ stripDefaults: true }).default({}),
);

const screenNodeStates = Primitive.Array(screenNodeStateSchema).default([]);

/** ScreenNode tree node schema */
export const ScreenNode = Primitive.TreeNode("screen", {
  children: [FlexNode, TextNode, ShapeNode] as const,
  data: Primitive.Struct({
    linkedVariables,
    localVariables,
    name: Primitive.String().default("Screen"),
    states: screenNodeStates,
    style: screenNodeStyleSchema,
  }),
});

export type ScreenNodeData = Types.TreeNodeSnapshot<typeof ScreenNode>;
