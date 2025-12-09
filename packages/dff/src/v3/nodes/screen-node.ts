import { s } from '../schema';
import { parentRefSchema } from './base';
import {
  x,
  y,
  width,
  height,
  minWidth,
  maxWidth,
  minHeight,
  maxHeight,
  paddingTop,
  paddingRight,
  paddingBottom,
  paddingLeft,
  marginTop,
  marginRight,
  marginBottom,
  marginLeft,
  gap,
  justifyContent,
  alignItems,
  flexDirection,
  backgroundColor,
  backgroundEnabled,
  borderWidthTop,
  borderWidthRight,
  borderWidthBottom,
  borderWidthLeft,
  borderColor,
  borderStyle,
  borderEnabled,
  opacity,
  overflow,
  zIndex,
  display,
  shadowEnabled,
  shadowColor,
  shadowOffsetX,
  shadowOffsetY,
  shadowBlurRadius,
  shadowOpacity,
  safeAreaTop,
  safeAreaBottom,
  flex,
  flexGrow,
  flexShrink,
  flexBasis,
  alignSelf
} from '../styles';
import type { Infer } from '../schema';

/** ScreenNode schema */
export const screenNode = s
  .object({
    id: s.string(),
    type: s.literal('screen'),
    name: s.string().default('Screen'),
    parent: parentRefSchema,
    style: s.object({
      // Position
      x,
      y,
      // Size
      width: width.default(375),
      height: height.default(812),
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
  })
  .refine(() => {
    // Children validation happens at document level
    return true;
  });

export type ScreenNodeData = Infer<typeof screenNode>;

/** Allowed child types for ScreenNode */
export const screenNodeAllowedChildren = ['flex', 'text'] as const;
