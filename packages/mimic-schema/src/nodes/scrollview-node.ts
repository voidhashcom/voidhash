import { Primitive } from "@voidhash/mimic-core";

import { interactionsSchema } from "../interactions/index.ts";
import { createStateSchemaWithStyleAndActionOverrides } from "../states/index.ts";
import {
  alignItems,
  alignSelf,
  backgroundColor,
  backgroundEnabled,
  backgroundGradient,
  backgroundImage,
  backgroundType,
  borderBottomLeftRadius,
  borderBottomRightRadius,
  borderBottomWidth,
  borderColor,
  borderEnabled,
  borderLeftWidth,
  borderRightWidth,
  borderStyle,
  borderTopLeftRadius,
  borderTopRightRadius,
  borderTopWidth,
  bottom,
  display,
  flex,
  flexBasis,
  flexDirection,
  flexGrow,
  flexShrink,
  gap,
  height,
  justifyContent,
  left,
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
  position,
  right,
  safeAreaBottom,
  safeAreaTop,
  shadowColor,
  shadowEnabled,
  shadowOffsetX,
  shadowOffsetY,
  shadowOpacity,
  shadowRadius,
  top,
  width,
  zIndex,
} from "../styles/index.ts";
import { linkedVariables, localVariables } from "./base.ts";
import { ComponentNode } from "./component-node.ts";
import { ShapeNode } from "./shape-node.ts";
import { TextNode } from "./text-node.ts";
import { ViewNode } from "./view-node.ts";

// Mirrors `viewNodeStyleSchema` field-for-field; scrollView carries the same
// style surface as a view. Duplicated (not imported from view-node.ts) to keep
// module evaluation order independent of the mutual view ⇄ scrollView import.
export const scrollViewNodeStyleSchema = Primitive.Struct({
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
  backgroundType,
  backgroundGradient,
  backgroundImage,
  // Border
  borderTopWidth,
  borderRightWidth,
  borderBottomWidth,
  borderLeftWidth,
  borderColor,
  borderStyle,
  borderEnabled,
  // Border radius
  borderTopLeftRadius,
  borderTopRightRadius,
  borderBottomRightRadius,
  borderBottomLeftRadius,
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
  // Safe area
  safeAreaTop,
  safeAreaBottom,
  // Flex child
  flex,
  flexGrow,
  flexShrink,
  flexBasis,
  alignSelf: alignSelf.default("auto"),
}).default({});

export const scrollViewNodeStateSchema = createStateSchemaWithStyleAndActionOverrides(
  scrollViewNodeStyleSchema.partial({ stripDefaults: true }).default({}),
);

const scrollViewNodeStates = Primitive.Array(scrollViewNodeStateSchema).default([]);

// Per-locale background-image overrides. Mirrors `viewNodeLocalizedSchema`
// field-for-field; scrollView carries the same localizable surface as a view.
// Duplicated (not imported from view-node.ts) to keep module evaluation order
// independent of the mutual view ⇄ scrollView import. `backgroundImage` (url +
// resizeMode) travels as a whole value; `.partial({ stripDefaults: true })`
// drops its own default so an entry that omits it falls back to the base style
// rather than materializing an empty image.
const scrollViewNodeLocalizedSchema = Primitive.Array(
  Primitive.Struct({
    locale: Primitive.String().required(),
    overrides: Primitive.Struct({
      backgroundImage,
    })
      .partial({ stripDefaults: true })
      .default({}),
  }),
).default([]);

const scrollViewNodeData = Primitive.Struct({
  /** RN ScrollView: lay children out along the horizontal axis instead of vertical. */
  horizontal: Primitive.Boolean().default(false),
  interactions: interactionsSchema,
  linkedVariables,
  localVariables,
  localized: scrollViewNodeLocalizedSchema,
  name: Primitive.String().default("ScrollView"),
  /** RN ScrollView: whether the scroll indicator (scrollbar) is visible. */
  showsScrollIndicator: Primitive.Boolean().default(true),
  states: scrollViewNodeStates,
  style: scrollViewNodeStyleSchema,
}).required();

/**
 * ScrollViewNode tree node schema — a scrollable container mirroring
 * {@link ViewNode}'s style/state/children capabilities, plus the RN ScrollView
 * data fields `horizontal` and `showsScrollIndicator`.
 *
 * The explicit `TreeNodePrimitive` annotation breaks the mutual recursion with
 * `ViewNode` (TS7022/TS7023), matching the pattern used by `ComponentNode`.
 */
export const ScrollViewNode: Primitive.TreeNodePrimitive<"scrollView", typeof scrollViewNodeData> =
  Primitive.TreeNode("scrollView", {
    children: () =>
      [ViewNode, Primitive.TreeNodeSelf, TextNode, ShapeNode, ComponentNode] as const,
    data: scrollViewNodeData,
  });

export type ScrollViewNodeData = Primitive.TreeNodeSnapshot<typeof ScrollViewNode>;
export type ScrollViewNodeStateSnapshot = NonNullable<
  Primitive.InferSnapshot<typeof scrollViewNodeStateSchema>
>;
export type ScrollViewNodeUpdateValue = Primitive.InferUpdateInput<
  Primitive.InferTreeNodeData<typeof ScrollViewNode>
>;
