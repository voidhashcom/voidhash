import { s } from '../schema';

// Spacing
export const paddingTop = s.number().default(0);
export const paddingRight = s.number().default(0);
export const paddingBottom = s.number().default(0);
export const paddingLeft = s.number().default(0);
export const marginTop = s.number().default(0);
export const marginRight = s.number().default(0);
export const marginBottom = s.number().default(0);
export const marginLeft = s.number().default(0);
export const gap = s.number().default(0);

// Layout
export const justifyContent = s
  .union([
    s.literal('flex-start'),
    s.literal('center'),
    s.literal('flex-end'),
    s.literal('space-between'),
    s.literal('space-around'),
    s.literal('space-evenly')
  ])
  .default('flex-start');

export const alignItems = s
  .union([
    s.literal('flex-start'),
    s.literal('center'),
    s.literal('flex-end'),
    s.literal('stretch'),
    s.literal('baseline')
  ])
  .default('flex-start');

export const flexDirection = s
  .union([s.literal('row'), s.literal('column')])
  .default('column');

// Flex child
export const flex = s.union([s.number(), s.literal(null)]).default(null);
export const flexGrow = s.number().default(0);
export const flexShrink = s.number().default(1);
export const flexBasis = s
  .union([s.number(), s.literal('auto')])
  .default('auto');
export const alignSelf = s
  .union([
    s.literal('auto'),
    s.literal('flex-start'),
    s.literal('center'),
    s.literal('flex-end'),
    s.literal('stretch'),
    s.literal('baseline')
  ])
  .default('auto');

// Size
export const width = s.union([s.number(), s.literal(null)]).default(100);
export const height = s.union([s.number(), s.literal(null)]).default(100);
export const minWidth = s.union([s.number(), s.literal(null)]).default(null);
export const maxWidth = s.union([s.number(), s.literal(null)]).default(null);
export const minHeight = s.union([s.number(), s.literal(null)]).default(null);
export const maxHeight = s.union([s.number(), s.literal(null)]).default(null);

// Position (for root nodes on canvas)
export const x = s.number().default(0);
export const y = s.number().default(0);

// Background
export const backgroundColor = s.string().default('rgba(255, 255, 255, 1)');
export const backgroundEnabled = s.boolean().default(false);

// Border
export const borderWidthTop = s.number().default(0);
export const borderWidthRight = s.number().default(0);
export const borderWidthBottom = s.number().default(0);
export const borderWidthLeft = s.number().default(0);
export const borderColor = s.string().default('rgba(0, 0, 0, 1)');
export const borderStyle = s
  .union([s.literal('solid'), s.literal('dashed'), s.literal('dotted')])
  .default('solid');
export const borderRadius = s.number().default(0);
export const borderRadiusTopLeft = s.number().default(0);
export const borderRadiusTopRight = s.number().default(0);
export const borderRadiusBottomRight = s.number().default(0);
export const borderRadiusBottomLeft = s.number().default(0);
export const borderEnabled = s.boolean().default(false);

// Visual
export const opacity = s.number().default(1);
export const overflow = s
  .union([s.literal('visible'), s.literal('hidden'), s.literal('scroll')])
  .default('visible');
export const zIndex = s.number().default(0);
export const display = s
  .union([s.literal('flex'), s.literal('none')])
  .default('flex');

// Shadow
export const shadowEnabled = s.boolean().default(false);
export const shadowColor = s.string().default('rgba(0, 0, 0, 1)');
export const shadowOffsetX = s.number().default(0);
export const shadowOffsetY = s.number().default(0);
export const shadowBlurRadius = s.number().default(0);
export const shadowOpacity = s.number().default(1);

// Typography
export const fontSize = s.number().default(16);
export const fontWeight = s
  .union([
    s.literal('100'),
    s.literal('200'),
    s.literal('300'),
    s.literal('400'),
    s.literal('500'),
    s.literal('600'),
    s.literal('700'),
    s.literal('800'),
    s.literal('900')
  ])
  .default('400');
export const color = s.string().default('rgba(0, 0, 0, 1)');
export const textAlign = s
  .union([
    s.literal('left'),
    s.literal('center'),
    s.literal('right'),
    s.literal('justify')
  ])
  .default('left');
export const lineHeight = s.number().default(1.5);
export const letterSpacing = s.number().default(0);

// Safe area
export const safeAreaTop = s.boolean().default(false);
export const safeAreaBottom = s.boolean().default(false);
