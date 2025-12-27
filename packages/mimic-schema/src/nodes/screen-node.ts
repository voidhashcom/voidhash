import { Primitive } from '@voidhash/mimic';
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
  zIndex
} from '../styles';
import {
  linkedVariables,
  localVariables,
  parentRefSchema,
  states
} from './base';
import { FlexNode } from './flex-node';
import { TextNode } from './text-node';

/** ScreenNode tree node schema */
export const ScreenNode = Primitive.TreeNode('screen', {
  data: Primitive.Struct({
    name: Primitive.String().default('Screen'),
    parent: parentRefSchema,
    localVariables,
    linkedVariables,
    states,
    style: Primitive.Struct({
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
      backgroundColor: backgroundColor.default('rgba(255, 255, 255, 1)'),
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
      alignSelf
    })
  }),
  children: () => [FlexNode, TextNode] as const
});

export type ScreenNodeData = Primitive.TypedTreeNodeState<typeof ScreenNode>;
