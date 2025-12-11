import type { Infer } from '../schema';
import { s } from '../schema';
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
  zIndex
} from '../styles';
import { linkedVariables, localVariables, parentRefSchema } from './base';

/** TextNode schema */
export const textNode = s.object({
  id: s.string(),
  type: s.literal('text'),
  name: s.string().default('Text'),
  parent: parentRefSchema,
  text: s.string().default('New Text'),
  localVariables,
  linkedVariables,
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
