import { Primitive } from "@voidhash/mimic";

import {
  alignSelf,
  borderColor,
  borderEnabled,
  borderStyle,
  borderWidthBottom,
  borderWidthLeft,
  borderWidthRight,
  borderWidthTop,
  color,
  display,
  flex,
  flexBasis,
  flexGrow,
  flexShrink,
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
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
  shadowBlurRadius,
  shadowColor,
  shadowEnabled,
  shadowOffsetX,
  shadowOffsetY,
  shadowOpacity,
  textAlign,
  zIndex,
} from "../styles";
import { linkedVariables, localVariables, states } from "./base";

/** TextNode tree node schema */
export const TextNode = Primitive.TreeNode("text", {
  children: [] as const,
  data: Primitive.Struct({
    linkedVariables,
    localVariables,
    name: Primitive.String().default("Text"),
    states,
    style: Primitive.Struct({
      // Margin
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
      // Size constraints
      minWidth,
      maxWidth,
      minHeight,
      maxHeight,
      // Typography
      fontSize,
      fontWeight,
      color,
      textAlign,
      lineHeight,
      letterSpacing,
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
      // Flex child
      flex,
      flexGrow,
      flexShrink,
      flexBasis,
      alignSelf,
    }),
    text: Primitive.String().default("New Text"),
  }),
});

export type TextNodeData = Primitive.TreeNodeSnapshot<typeof TextNode>;
