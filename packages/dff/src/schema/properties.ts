import { Schema } from "effect";
import { defineProperty } from "../core/define-property";

// ============================================================================
// Base Schema Types (for reference and backwards compatibility)
// ============================================================================

export const JustifyContentSchema = Schema.Literal(
	"flex-start",
	"center",
	"flex-end",
	"space-between",
	"space-around",
	"space-evenly",
);

export type JustifyContent = Schema.Schema.Type<typeof JustifyContentSchema>;

export const AlignItemsSchema = Schema.Literal(
	"flex-start",
	"center",
	"flex-end",
	"stretch",
	"baseline",
);

export type AlignItems = Schema.Schema.Type<typeof AlignItemsSchema>;

export const FontWeightSchema = Schema.Literal(
	"100",
	"200",
	"300",
	"400",
	"500",
	"600",
	"700",
	"800",
	"900",
);

export type FontWeight = Schema.Schema.Type<typeof FontWeightSchema>;

export const TextAlignSchema = Schema.Literal(
	"left",
	"center",
	"right",
	"justify",
);

export type TextAlign = Schema.Schema.Type<typeof TextAlignSchema>;

// ============================================================================
// Property Definitions (flat/atomic values)
// ============================================================================

// --- Padding Properties ---
export const paddingTop = defineProperty("paddingTop", {
	schema: Schema.optionalWith(Schema.Number, { default: () => 0 }),
	default: () => 0,
});

export const paddingRight = defineProperty("paddingRight", {
	schema: Schema.optionalWith(Schema.Number, { default: () => 0 }),
	default: () => 0,
});

export const paddingBottom = defineProperty("paddingBottom", {
	schema: Schema.optionalWith(Schema.Number, { default: () => 0 }),
	default: () => 0,
});

export const paddingLeft = defineProperty("paddingLeft", {
	schema: Schema.optionalWith(Schema.Number, { default: () => 0 }),
	default: () => 0,
});

export type Padding = {
	paddingTop: number;
	paddingRight: number;
	paddingBottom: number;
	paddingLeft: number;
};

// --- Safe Area Properties ---
export const safeAreaTop = defineProperty("safeAreaTop", {
	schema: Schema.optionalWith(Schema.Boolean, { default: () => false }),
	default: () => false,
});

export const safeAreaBottom = defineProperty("safeAreaBottom", {
	schema: Schema.optionalWith(Schema.Boolean, { default: () => false }),
	default: () => false,
});

/** Convenience grouping for safe area properties */
export const safeAreaProperties = [safeAreaTop, safeAreaBottom] as const;

// --- Layout Properties ---
export const gap = defineProperty("gap", {
	schema: Schema.optionalWith(Schema.Number, { default: () => 0 }),
	default: () => 0,
});

export const justifyContent = defineProperty("justifyContent", {
	schema: Schema.optionalWith(JustifyContentSchema, {
		default: () => "flex-start" as const,
	}),
	default: () => "flex-start" as const,
});

export const alignItems = defineProperty("alignItems", {
	schema: Schema.optionalWith(AlignItemsSchema, {
		default: () => "flex-start" as const,
	}),
	default: () => "flex-start" as const,
});

// --- Position Properties ---
export const x = defineProperty("x", {
	schema: Schema.Number,
	default: () => 0,
});

export const y = defineProperty("y", {
	schema: Schema.Number,
	default: () => 0,
});

export const width = defineProperty("width", {
	schema: Schema.Number,
	default: () => 375,
});

export const height = defineProperty("height", {
	schema: Schema.Number,
	default: () => 812,
});

// --- Color Properties ---

export const backgroundEnabled = defineProperty("backgroundEnabled", {
	schema: Schema.optionalWith(Schema.Boolean, { default: () => false }),
	default: () => false,
});

export const backgroundColor = defineProperty("backgroundColor", {
	schema: Schema.optionalWith(Schema.String, { default: () => "#ffffff" }),
	default: () => "#ffffff",
});

export const color = defineProperty("color", {
	schema: Schema.optionalWith(Schema.String, { default: () => "#000000" }),
	default: () => "#000000",
});

// --- Text Properties ---
export const text = defineProperty("text", {
	schema: Schema.String,
	default: () => "New Text",
});

export const fontSize = defineProperty("fontSize", {
	schema: Schema.optionalWith(Schema.Number, { default: () => 16 }),
	default: () => 16,
});

export const fontWeight = defineProperty("fontWeight", {
	schema: Schema.optionalWith(FontWeightSchema, {
		default: () => "400" as const,
	}),
	default: () => "400" as const,
});

export const textAlign = defineProperty("textAlign", {
	schema: Schema.optionalWith(TextAlignSchema, {
		default: () => "left" as const,
	}),
	default: () => "left" as const,
});

export const lineHeight = defineProperty("lineHeight", {
	schema: Schema.optionalWith(Schema.Number, { default: () => 1.5 }),
	default: () => 1.5,
});

export const letterSpacing = defineProperty("letterSpacing", {
	schema: Schema.optionalWith(Schema.Number, { default: () => 0 }),
	default: () => 0,
});

// ============================================================================
// Margin Properties
// ============================================================================

export const marginTop = defineProperty("marginTop", {
	schema: Schema.optionalWith(Schema.Number, { default: () => 0 }),
	default: () => 0,
});

export const marginRight = defineProperty("marginRight", {
	schema: Schema.optionalWith(Schema.Number, { default: () => 0 }),
	default: () => 0,
});

export const marginBottom = defineProperty("marginBottom", {
	schema: Schema.optionalWith(Schema.Number, { default: () => 0 }),
	default: () => 0,
});

export const marginLeft = defineProperty("marginLeft", {
	schema: Schema.optionalWith(Schema.Number, { default: () => 0 }),
	default: () => 0,
});

export type Margin = {
	marginTop: number;
	marginRight: number;
	marginBottom: number;
	marginLeft: number;
};

// ============================================================================
// Border Properties
// ============================================================================

export const borderWidth = defineProperty("borderWidth", {
	schema: Schema.optionalWith(Schema.Number, { default: () => 0 }),
	default: () => 0,
});

export const borderColor = defineProperty("borderColor", {
	schema: Schema.optionalWith(Schema.NullOr(Schema.String), {
		default: () => null,
	}),
	default: () => null,
});

export const BorderStyleSchema = Schema.Literal("solid", "dashed", "dotted");

export type BorderStyle = Schema.Schema.Type<typeof BorderStyleSchema>;

export const borderStyle = defineProperty("borderStyle", {
	schema: Schema.optionalWith(BorderStyleSchema, {
		default: () => "solid" as const,
	}),
	default: () => "solid" as const,
});

export const borderRadius = defineProperty("borderRadius", {
	schema: Schema.optionalWith(Schema.Number, { default: () => 0 }),
	default: () => 0,
});

export const borderTopLeftRadius = defineProperty("borderTopLeftRadius", {
	schema: Schema.optionalWith(Schema.Number, { default: () => 0 }),
	default: () => 0,
});

export const borderTopRightRadius = defineProperty("borderTopRightRadius", {
	schema: Schema.optionalWith(Schema.Number, { default: () => 0 }),
	default: () => 0,
});

export const borderBottomLeftRadius = defineProperty("borderBottomLeftRadius", {
	schema: Schema.optionalWith(Schema.Number, { default: () => 0 }),
	default: () => 0,
});

export const borderBottomRightRadius = defineProperty(
	"borderBottomRightRadius",
	{
		schema: Schema.optionalWith(Schema.Number, { default: () => 0 }),
		default: () => 0,
	},
);

/** Convenience grouping for individual border radius properties */
export const borderRadiusProperties = [
	borderTopLeftRadius,
	borderTopRightRadius,
	borderBottomLeftRadius,
	borderBottomRightRadius,
] as const;

// ============================================================================
// Size Constraint Properties
// ============================================================================

export const minWidth = defineProperty("minWidth", {
	schema: Schema.optionalWith(Schema.NullOr(Schema.Number), {
		default: () => null,
	}),
	default: () => null,
});

export const maxWidth = defineProperty("maxWidth", {
	schema: Schema.optionalWith(Schema.NullOr(Schema.Number), {
		default: () => null,
	}),
	default: () => null,
});

export const minHeight = defineProperty("minHeight", {
	schema: Schema.optionalWith(Schema.NullOr(Schema.Number), {
		default: () => null,
	}),
	default: () => null,
});

export const maxHeight = defineProperty("maxHeight", {
	schema: Schema.optionalWith(Schema.NullOr(Schema.Number), {
		default: () => null,
	}),
	default: () => null,
});

/** Convenience grouping for size constraint properties */
export const sizeConstraintProperties = [] as const;

// ============================================================================
// Flex Child Properties
// ============================================================================

export const flex = defineProperty("flex", {
	schema: Schema.optionalWith(Schema.NullOr(Schema.Number), {
		default: () => null,
	}),
	default: () => null,
});

export const FlexDirectionSchema = Schema.Literal("row", "column");

export type FlexDirection = Schema.Schema.Type<typeof FlexDirectionSchema>;

export const flexDirection = defineProperty("flexDirection", {
	schema: Schema.optionalWith(FlexDirectionSchema, {
		default: () => "row" as const,
	}),
	default: () => "row" as const,
});

export const flexGrow = defineProperty("flexGrow", {
	schema: Schema.optionalWith(Schema.Number, { default: () => 0 }),
	default: () => 0,
});

export const flexShrink = defineProperty("flexShrink", {
	schema: Schema.optionalWith(Schema.Number, { default: () => 1 }),
	default: () => 1,
});

export const FlexBasisSchema = Schema.Union(
	Schema.Number,
	Schema.Literal("auto"),
);

export type FlexBasis = Schema.Schema.Type<typeof FlexBasisSchema>;

export const flexBasis = defineProperty("flexBasis", {
	schema: Schema.optionalWith(FlexBasisSchema, {
		default: () => "auto" as const,
	}),
	default: () => "auto" as const,
});

export const AlignSelfSchema = Schema.Literal(
	"auto",
	"flex-start",
	"center",
	"flex-end",
	"stretch",
	"baseline",
);

export type AlignSelf = Schema.Schema.Type<typeof AlignSelfSchema>;

export const alignSelf = defineProperty("alignSelf", {
	schema: Schema.optionalWith(AlignSelfSchema, {
		default: () => "auto" as const,
	}),
	default: () => "auto" as const,
});

// ============================================================================
// Visual Properties
// ============================================================================

export const opacity = defineProperty("opacity", {
	schema: Schema.optionalWith(Schema.Number, { default: () => 1 }),
	default: () => 1,
});

export const OverflowSchema = Schema.Literal("visible", "hidden", "scroll");

export type Overflow = Schema.Schema.Type<typeof OverflowSchema>;

export const overflow = defineProperty("overflow", {
	schema: Schema.optionalWith(OverflowSchema, {
		default: () => "visible" as const,
	}),
	default: () => "visible" as const,
});

export const zIndex = defineProperty("zIndex", {
	schema: Schema.optionalWith(Schema.Number, { default: () => 0 }),
	default: () => 0,
});

export const DisplaySchema = Schema.Literal("flex", "none");

export type Display = Schema.Schema.Type<typeof DisplaySchema>;

export const display = defineProperty("display", {
	schema: Schema.optionalWith(DisplaySchema, {
		default: () => "flex" as const,
	}),
	default: () => "flex" as const,
});

// ============================================================================
// Shadow Properties
// ============================================================================

export const shadowEnabled = defineProperty("shadowEnabled", {
	schema: Schema.optionalWith(Schema.Boolean, { default: () => false }),
	default: () => false,
});

export const shadowColor = defineProperty("shadowColor", {
	schema: Schema.optionalWith(Schema.NullOr(Schema.String), {
		default: () => "#000000",
	}),
	default: () => "#000000",
});

export const shadowOffsetX = defineProperty("shadowOffsetX", {
	schema: Schema.optionalWith(Schema.Number, { default: () => 0 }),
	default: () => 0,
});

export const shadowOffsetY = defineProperty("shadowOffsetY", {
	schema: Schema.optionalWith(Schema.Number, { default: () => 0 }),
	default: () => 0,
});

export const shadowBlurRadius = defineProperty("shadowBlurRadius", {
	schema: Schema.optionalWith(Schema.Number, { default: () => 0 }),
	default: () => 0,
});

export const shadowOpacity = defineProperty("shadowOpacity", {
	schema: Schema.optionalWith(Schema.Number, { default: () => 1 }),
	default: () => 1,
});
