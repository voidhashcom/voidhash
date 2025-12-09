import { s } from '../schema';
import { parentRefSchema } from './base';
import {
  marginTop,
  marginRight,
  marginBottom,
  marginLeft,
  minWidth,
  maxWidth,
  minHeight,
  maxHeight,
  fontSize,
  fontWeight,
  color,
  textAlign,
  lineHeight,
  letterSpacing,
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
  flex,
  flexGrow,
  flexShrink,
  flexBasis,
  alignSelf
} from '../styles';
import type { Infer } from '../schema';

/** TextNode schema */
export const textNode = s.object({
  id: s.string(),
  type: s.literal('text'),
  name: s.string().default('Text'),
  parent: parentRefSchema,
  text: s.string().default('New Text'),
  style: s.object({
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
    alignSelf
  })
});

export type TextNodeData = Infer<typeof textNode>;

/** Allowed child types for TextNode */
export const textNodeAllowedChildren = [] as const;
