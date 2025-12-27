// import { z } from 'zod';

// // Spacing
// export const paddingTop = z.number().default(0);
// export const paddingRight = z.number().default(0);
// export const paddingBottom = z.number().default(0);
// export const paddingLeft = z.number().default(0);
// export const marginTop = z.number().default(0);
// export const marginRight = z.number().default(0);
// export const marginBottom = z.number().default(0);
// export const marginLeft = z.number().default(0);
// export const gap = z.number().default(0);

// // Layout
// export const justifyContent = z
//   .union([
//     z.literal('flex-start'),
//     z.literal('center'),
//     z.literal('flex-end'),
//     z.literal('space-between'),
//     z.literal('space-around'),
//     z.literal('space-evenly')
//   ])
//   .default('flex-start');

// export const alignItems = z
//   .union([
//     z.literal('flex-start'),
//     z.literal('center'),
//     z.literal('flex-end'),
//     z.literal('stretch'),
//     z.literal('baseline')
//   ])
//   .default('flex-start');

// export const flexDirection = z
//   .union([z.literal('row'), z.literal('column')])
//   .default('column');

// // Flex child
// export const flex = z.union([z.number(), z.literal(null)]).default(null);
// export const flexGrow = z.number().default(0);
// export const flexShrink = z.number().default(1);
// export const flexBasis = z
//   .union([z.number(), z.literal('auto')])
//   .default('auto');
// export const alignSelf = z
//   .union([
//     z.literal('auto'),
//     z.literal('flex-start'),
//     z.literal('center'),
//     z.literal('flex-end'),
//     z.literal('stretch'),
//     z.literal('baseline')
//   ])
//   .default('auto');

// // Size
// export const width = z.union([z.number(), z.literal(null)]).default(100);
// export const height = z.union([z.number(), z.literal(null)]).default(100);
// export const minWidth = z.union([z.number(), z.literal(null)]).default(null);
// export const maxWidth = z.union([z.number(), z.literal(null)]).default(null);
// export const minHeight = z.union([z.number(), z.literal(null)]).default(null);
// export const maxHeight = z.union([z.number(), z.literal(null)]).default(null);

// // Position (for root nodes on canvas)
// export const x = z.number().default(0);
// export const y = z.number().default(0);

// // Background
// export const backgroundColor = z.string().default('rgba(255, 255, 255, 1)');
// export const backgroundEnabled = z.boolean().default(false);

// // Border
// export const borderWidthTop = z.number().default(0);
// export const borderWidthRight = z.number().default(0);
// export const borderWidthBottom = z.number().default(0);
// export const borderWidthLeft = z.number().default(0);
// export const borderColor = z.string().default('rgba(0, 0, 0, 1)');
// export const borderStyle = z
//   .union([z.literal('solid'), z.literal('dashed'), z.literal('dotted')])
//   .default('solid');
// export const borderRadius = z.number().default(0);
// export const borderRadiusTopLeft = z.number().default(0);
// export const borderRadiusTopRight = z.number().default(0);
// export const borderRadiusBottomRight = z.number().default(0);
// export const borderRadiusBottomLeft = z.number().default(0);
// export const borderEnabled = z.boolean().default(false);

// // Visual
// export const opacity = z.number().default(1);
// export const overflow = z
//   .union([z.literal('visible'), z.literal('hidden'), z.literal('scroll')])
//   .default('visible');
// export const zIndex = z.number().default(0);
// export const display = z
//   .union([z.literal('flex'), z.literal('none')])
//   .default('flex');

// // Shadow
// export const shadowEnabled = z.boolean().default(false);
// export const shadowColor = z.string().default('rgba(0, 0, 0, 1)');
// export const shadowOffsetX = z.number().default(0);
// export const shadowOffsetY = z.number().default(0);
// export const shadowBlurRadius = z.number().default(0);
// export const shadowOpacity = z.number().default(1);

// // Typography
// export const fontSize = z.number().default(16);
// export const fontWeight = z
//   .union([
//     z.literal('100'),
//     z.literal('200'),
//     z.literal('300'),
//     z.literal('400'),
//     z.literal('500'),
//     z.literal('600'),
//     z.literal('700'),
//     z.literal('800'),
//     z.literal('900')
//   ])
//   .default('400');
// export const color = z.string().default('rgba(0, 0, 0, 1)');
// export const textAlign = z
//   .union([
//     z.literal('left'),
//     z.literal('center'),
//     z.literal('right'),
//     z.literal('justify')
//   ])
//   .default('left');
// export const lineHeight = z.number().default(1.5);
// export const letterSpacing = z.number().default(0);

// // Safe area
// export const safeAreaTop = z.boolean().default(false);
// export const safeAreaBottom = z.boolean().default(false);
