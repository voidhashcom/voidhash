// import { z } from 'zod';
// import {
//   alignItems,
//   alignSelf,
//   backgroundColor,
//   backgroundEnabled,
//   borderColor,
//   borderEnabled,
//   borderStyle,
//   borderWidthBottom,
//   borderWidthLeft,
//   borderWidthRight,
//   borderWidthTop,
//   display,
//   flex,
//   flexBasis,
//   flexDirection,
//   flexGrow,
//   flexShrink,
//   gap,
//   justifyContent,
//   marginBottom,
//   marginLeft,
//   marginRight,
//   marginTop,
//   maxHeight,
//   maxWidth,
//   minHeight,
//   minWidth,
//   opacity,
//   overflow,
//   paddingBottom,
//   paddingLeft,
//   paddingRight,
//   paddingTop,
//   safeAreaBottom,
//   safeAreaTop,
//   shadowBlurRadius,
//   shadowColor,
//   shadowEnabled,
//   shadowOffsetX,
//   shadowOffsetY,
//   shadowOpacity,
//   x,
//   y,
//   zIndex
// } from '../styles';
// import {
//   linkedVariables,
//   localVariables,
//   parentRefSchema,
//   states
// } from './base';

// /** ScreenNode schema */
// export const screenNode = z
//   .object({
//     id: z.string(),
//     type: z.literal('screen'),
//     name: z.string().default('Screen'),
//     parent: parentRefSchema,
//     localVariables,
//     linkedVariables,
//     states,
//     style: z.object({
//       // Position
//       x,
//       y,
//       // Size
//       width: z.number().default(375),
//       height: z.number().default(812),
//       minWidth,
//       maxWidth,
//       minHeight,
//       maxHeight,
//       // Padding
//       paddingTop,
//       paddingRight,
//       paddingBottom,
//       paddingLeft,
//       // Margin
//       marginTop,
//       marginRight,
//       marginBottom,
//       marginLeft,
//       // Layout
//       gap,
//       justifyContent,
//       alignItems,
//       flexDirection,
//       // Background
//       backgroundColor: backgroundColor.default('rgba(255, 255, 255, 1)'),
//       backgroundEnabled: backgroundEnabled.default(true),
//       // Border
//       borderWidthTop,
//       borderWidthRight,
//       borderWidthBottom,
//       borderWidthLeft,
//       borderColor,
//       borderStyle,
//       borderEnabled,
//       // Visual
//       opacity,
//       overflow,
//       zIndex,
//       display,
//       // Shadow
//       shadowEnabled,
//       shadowColor,
//       shadowOffsetX,
//       shadowOffsetY,
//       shadowBlurRadius,
//       shadowOpacity,
//       // Safe area
//       safeAreaTop,
//       safeAreaBottom,
//       // Flex child
//       flex,
//       flexGrow,
//       flexShrink,
//       flexBasis,
//       alignSelf
//     })
//   })
//   .refine(() => {
//     // Children validation happens at document level
//     return true;
//   });

// export type ScreenNodeData = z.infer<typeof screenNode>;

// /** Allowed child types for ScreenNode */
// export const screenNodeAllowedChildren = ['flex', 'text'] as const;
