import { Primitive } from "@voidhash/mimic-core";

import { createStateSchemaWithStyleOverrides } from "../states/index.ts";
import {
  alignSelf,
  borderBottomWidth,
  borderColor,
  borderEnabled,
  borderLeftWidth,
  borderRightWidth,
  borderStyle,
  borderTopWidth,
  bottom,
  color,
  display,
  flex,
  flexBasis,
  flexGrow,
  flexShrink,
  fontSize,
  fontWeight,
  left,
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
  position,
  right,
  shadowColor,
  shadowEnabled,
  shadowOffsetX,
  shadowOffsetY,
  shadowOpacity,
  shadowRadius,
  textAlign,
  top,
  zIndex,
} from "../styles/index.ts";
import { linkedVariables, localVariables } from "./base.ts";

export const textNodeStyleSchema = Primitive.Struct({
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
  borderTopWidth,
  borderRightWidth,
  borderBottomWidth,
  borderLeftWidth,
  borderColor,
  borderStyle,
  borderEnabled,
  // Visual
  opacity,
  overflow,
  zIndex,
  // Position
  position,
  left,
  top,
  right,
  bottom,
  display,
  // Shadow
  shadowEnabled,
  shadowColor,
  shadowOffsetX,
  shadowOffsetY,
  shadowRadius,
  shadowOpacity,
  // Flex child
  flex,
  flexGrow,
  flexShrink,
  flexBasis,
  alignSelf,
}).default({});

export const textNodeStateSchema = createStateSchemaWithStyleOverrides(
  textNodeStyleSchema.partial({ stripDefaults: true }).default({}),
);

const textNodeStates = Primitive.Array(textNodeStateSchema).default([]);

// Per-locale text overrides. `text` is optional and defaultless, so an entry
// whose overrides omit `text` (or clear it back to unset) falls back to the base
// `text` — mirroring the "absent = fall back" discipline of state overrides.
export const textNodeLocalizedSchema = Primitive.Array(
  Primitive.Struct({
    locale: Primitive.String().required(),
    overrides: Primitive.Struct({
      text: Primitive.String(),
    }).default({}),
  }),
).default([]);

/** TextNode tree node schema */
export const TextNode = Primitive.TreeNode("text", {
  children: [] as const,
  data: Primitive.Struct({
    linkedVariables,
    localVariables,
    localized: textNodeLocalizedSchema,
    name: Primitive.String().default("Text"),
    states: textNodeStates,
    style: textNodeStyleSchema,
    text: Primitive.String().default("New Text"),
  }).required(),
});

export type TextNodeData = Primitive.TreeNodeSnapshot<typeof TextNode>;
