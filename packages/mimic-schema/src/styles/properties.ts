import { Primitive } from "@voidhash/mimic";

const RGBaRegex =
  /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d*\.?\d+)\s*\)$/i;

// Spacing
export const paddingTop = Primitive.Number().default(0);
export const paddingRight = Primitive.Number().default(0);
export const paddingBottom = Primitive.Number().default(0);
export const paddingLeft = Primitive.Number().default(0);
export const marginTop = Primitive.Number().default(0);
export const marginRight = Primitive.Number().default(0);
export const marginBottom = Primitive.Number().default(0);
export const marginLeft = Primitive.Number().default(0);
export const gap = Primitive.Number().default(0);

// Layout
export const justifyContent = Primitive.Either(
  Primitive.Literal("flex-start"),
  Primitive.Literal("center"),
  Primitive.Literal("flex-end"),
  Primitive.Literal("space-between"),
  Primitive.Literal("space-around"),
  Primitive.Literal("space-evenly")
).default("flex-start");

export const alignItems = Primitive.Either(
  Primitive.Literal("flex-start"),
  Primitive.Literal("center"),
  Primitive.Literal("flex-end"),
  Primitive.Literal("stretch"),
  Primitive.Literal("baseline")
).default("flex-start");

export const flexDirection = Primitive.Either(
  Primitive.Literal("row"),
  Primitive.Literal("column")
).default("column");

// Flex child
export const flex = Primitive.Either(
  Primitive.Number(),
  Primitive.Literal(null)
).default(null);
export const flexGrow = Primitive.Number().default(0);
export const flexShrink = Primitive.Number().default(1);
export const flexBasis = Primitive.Either(
  Primitive.Number(),
  Primitive.Literal("auto")
).default("auto");
export const alignSelf = Primitive.Either(
  Primitive.Literal("auto"),
  Primitive.Literal("flex-start"),
  Primitive.Literal("center"),
  Primitive.Literal("flex-end"),
  Primitive.Literal("stretch"),
  Primitive.Literal("baseline")
).default("auto");

// Size
export const width = Primitive.Either(
  Primitive.Number(),
  Primitive.Literal(null)
).default(100);
export const height = Primitive.Either(
  Primitive.Number(),
  Primitive.Literal(null)
).default(100);
export const minWidth = Primitive.Either(
  Primitive.Number(),
  Primitive.Literal(null)
).default(null);
export const maxWidth = Primitive.Either(
  Primitive.Number(),
  Primitive.Literal(null)
).default(null);
export const minHeight = Primitive.Either(
  Primitive.Number(),
  Primitive.Literal(null)
).default(null);
export const maxHeight = Primitive.Either(
  Primitive.Number(),
  Primitive.Literal(null)
).default(null);

// Position (for root nodes on canvas)
export const x = Primitive.Number().default(0);
export const y = Primitive.Number().default(0);

// Background
export const backgroundColor = Primitive.String()
  .default("rgba(255, 255, 255, 1)")
  .regex(RGBaRegex, "Invalid RGBA color format");
export const backgroundEnabled = Primitive.Boolean().default(false);

// Border
export const borderWidthTop = Primitive.Number().default(0);
export const borderWidthRight = Primitive.Number().default(0);
export const borderWidthBottom = Primitive.Number().default(0);
export const borderWidthLeft = Primitive.Number().default(0);
export const borderColor = Primitive.String()
  .default("rgba(0, 0, 0, 1)")
  .regex(RGBaRegex, "Invalid RGBA color format");
export const borderStyle = Primitive.Either(
  Primitive.Literal("solid"),
  Primitive.Literal("dashed"),
  Primitive.Literal("dotted")
).default("solid");
export const borderRadius = Primitive.Number().default(0);
export const borderRadiusTopLeft = Primitive.Number().default(0);
export const borderRadiusTopRight = Primitive.Number().default(0);
export const borderRadiusBottomRight = Primitive.Number().default(0);
export const borderRadiusBottomLeft = Primitive.Number().default(0);
export const borderEnabled = Primitive.Boolean().default(false);

// Visual
export const opacity = Primitive.Number().default(1);
export const overflow = Primitive.Either(
  Primitive.Literal("visible"),
  Primitive.Literal("hidden"),
  Primitive.Literal("scroll")
).default("visible");
export const zIndex = Primitive.Number().default(0);
export const display = Primitive.Either(
  Primitive.Literal("flex"),
  Primitive.Literal("none")
).default("flex");

// Shadow
export const shadowEnabled = Primitive.Boolean().default(false);
export const shadowColor = Primitive.String()
  .default("rgba(0, 0, 0, 1)")
  .regex(RGBaRegex, "Invalid RGBA color format");
export const shadowOffsetX = Primitive.Number().default(0);
export const shadowOffsetY = Primitive.Number().default(0);
export const shadowBlurRadius = Primitive.Number().default(0);
export const shadowOpacity = Primitive.Number().default(1);

// Typography
export const fontSize = Primitive.Number().default(16).min(1);
export const fontWeight = Primitive.Either(
  Primitive.Literal("100"),
  Primitive.Literal("200"),
  Primitive.Literal("300"),
  Primitive.Literal("400"),
  Primitive.Literal("500"),
  Primitive.Literal("600"),
  Primitive.Literal("700"),
  Primitive.Literal("800"),
  Primitive.Literal("900")
).default("400");
export const color = Primitive.String()
  .default("rgba(0, 0, 0, 1)")
  .regex(RGBaRegex, "Invalid RGBA color format");
export const textAlign = Primitive.Either(
  Primitive.Literal("left"),
  Primitive.Literal("center"),
  Primitive.Literal("right"),
  Primitive.Literal("justify")
).default("left");
export const lineHeight = Primitive.Number().default(1.5);
export const letterSpacing = Primitive.Number().default(0);

// Safe area
export const safeAreaTop = Primitive.Boolean().default(false);
export const safeAreaBottom = Primitive.Boolean().default(false);
