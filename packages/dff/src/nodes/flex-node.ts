import type { Infer } from '../schema';
import { s } from '../schema';
import {
  alignItems,
  alignSelf,
  backgroundColor,
  backgroundEnabled,
  borderColor,
  borderEnabled,
  borderRadiusBottomLeft,
  borderRadiusBottomRight,
  borderRadiusTopLeft,
  borderRadiusTopRight,
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
  height,
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
  width,
  zIndex
} from '../styles';
import { parentRefSchema } from './base';

/** FlexNode schema */
export const flexNode = s
  .object({
    id: s.string(),
    type: s.literal('flex'),
    name: s.string().default('Flex'),
    parent: parentRefSchema,
    style: s.object({
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
      // Border
      borderWidthTop,
      borderWidthRight,
      borderWidthBottom,
      borderWidthLeft,
      borderColor,
      borderStyle,
      borderEnabled,
      // Border radius
      borderRadiusTopLeft,
      borderRadiusTopRight,
      borderRadiusBottomRight,
      borderRadiusBottomLeft,
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
      alignSelf: alignSelf.default('stretch')
    })
  })
  .refine(() => {
    // Children validation happens at document level
    return true;
  });

export type FlexNodeData = Infer<typeof flexNode>;

/** Allowed child types for FlexNode */
export const flexNodeAllowedChildren = ['flex', 'text'] as const;
