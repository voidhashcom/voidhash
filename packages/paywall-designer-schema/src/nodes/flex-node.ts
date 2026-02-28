import { Primitive } from "@voidhash/mimic";

import { interactionsSchema } from "../interactions";
import { createStateSchemaWithStyleAndActionOverrides } from "../states";
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
	zIndex,
} from "../styles";
import { linkedVariables, localVariables } from "./base";
import { ShapeNode } from "./shape-node";
import { TextNode } from "./text-node";

export const flexNodeStyleSchema = Primitive.Struct({
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
	alignSelf: alignSelf.default("auto"),
});

export const flexNodeStateSchema = createStateSchemaWithStyleAndActionOverrides(
	flexNodeStyleSchema.partial({ stripDefaults: true }).default({}),
);

const flexNodeStates = Primitive.Array(flexNodeStateSchema).default([]);

/** FlexNode tree node schema */
export const FlexNode = Primitive.TreeNode("flex", {
	children: [Primitive.TreeNodeSelf, TextNode, ShapeNode] as const,
	data: Primitive.Struct({
		interactions: interactionsSchema,
		linkedVariables,
		localVariables,
		name: Primitive.String().default("Flex"),
		states: flexNodeStates,
		style: flexNodeStyleSchema,
	}),
});

export type FlexNodeData = Primitive.TreeNodeSnapshot<typeof FlexNode>;
export type FlexNodeStateSnapshot = Primitive.InferSnapshot<
	typeof flexNodeStateSchema
>;
export type FlexNodeUpdateValue = Primitive.TreeNodeUpdateValue<
	typeof FlexNode
>;
