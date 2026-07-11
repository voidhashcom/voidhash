import { Primitive } from "@voidhash/mimic-core";

const RGBaRegex = /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d*\.?\d+)\s*\)$/i;

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
  Primitive.Literal("space-evenly"),
).default("flex-start");

export const alignItems = Primitive.Either(
  Primitive.Literal("flex-start"),
  Primitive.Literal("center"),
  Primitive.Literal("flex-end"),
  Primitive.Literal("stretch"),
  Primitive.Literal("baseline"),
).default("stretch");

export const flexDirection = Primitive.Either(
  Primitive.Literal("row"),
  Primitive.Literal("column"),
).default("column");

// Flex child — optional without default; absence means "no explicit flex"
export const flex = Primitive.Number();
export const flexGrow = Primitive.Number().default(0);
export const flexShrink = Primitive.Number().default(1);
export const flexBasis = Primitive.Either(Primitive.Number(), Primitive.Literal("auto")).default(
  "auto",
);
export const alignSelf = Primitive.Either(
  Primitive.Literal("auto"),
  Primitive.Literal("flex-start"),
  Primitive.Literal("center"),
  Primitive.Literal("flex-end"),
  Primitive.Literal("stretch"),
  Primitive.Literal("baseline"),
).default("auto");

// Size — "auto" (hug contents) is the CSS/RN default; views size to their
// content unless given an explicit number or stretched by their parent.
export const width = Primitive.Either(Primitive.Number(), Primitive.Literal("auto")).default("auto");
export const height = Primitive.Either(Primitive.Number(), Primitive.Literal("auto")).default(
  "auto",
);
// Size constraints — optional without default; absence means "unconstrained"
export const minWidth = Primitive.Number();
export const maxWidth = Primitive.Number();
export const minHeight = Primitive.Number();
export const maxHeight = Primitive.Number();

// Position (for root nodes on canvas)
export const x = Primitive.Number().default(0);
export const y = Primitive.Number().default(0);

// Positioned layout (RN flow) — `absolute` takes the node out of flow and
// positions it against its parent using the offsets below. `relative` (default)
// leaves it in normal flex flow. Offsets are `number | "auto"` (mirroring the
// "auto"-capable width/height dimensions); "auto" (default) means unset.
export const position = Primitive.Either(
  Primitive.Literal("absolute"),
  Primitive.Literal("relative"),
).default("relative");
export const left = Primitive.Either(Primitive.Number(), Primitive.Literal("auto")).default("auto");
export const top = Primitive.Either(Primitive.Number(), Primitive.Literal("auto")).default("auto");
export const right = Primitive.Either(Primitive.Number(), Primitive.Literal("auto")).default("auto");
export const bottom = Primitive.Either(Primitive.Number(), Primitive.Literal("auto")).default(
  "auto",
);

// Background
export const backgroundColor = Primitive.String()
  .default("rgba(255, 255, 255, 1)")
  .regex(RGBaRegex, "Invalid RGBA color format");
export const backgroundEnabled = Primitive.Boolean().default(false);

/**
 * Which background fill to render. `backgroundEnabled` gates ALL types; when
 * disabled the node is transparent regardless of this value. `solid` uses
 * `backgroundColor` (legacy behavior).
 */
export const backgroundType = Primitive.Either(
  Primitive.Literal("solid"),
  Primitive.Literal("gradient"),
  Primitive.Literal("image"),
).default("solid");

/**
 * Gradient background. Geometry is a two-point line in normalized node space
 * (`0..1` typical but not clamped): `start` → `end`. This maps directly onto
 * draggable canvas handles and expo-linear-gradient `start`/`end` on native.
 * `stops` colors are RGBA strings positioned `0..1` along that line.
 */
export const backgroundGradient = Primitive.Struct({
  kind: Primitive.Either(Primitive.Literal("linear"), Primitive.Literal("radial")).default("linear"),
  startX: Primitive.Number().default(0.5),
  startY: Primitive.Number().default(0),
  endX: Primitive.Number().default(0.5),
  endY: Primitive.Number().default(1),
  stops: Primitive.Array(
    Primitive.Struct({
      color: Primitive.String().default("rgba(255, 255, 255, 1)").regex(RGBaRegex, "Invalid RGBA color format"),
      position: Primitive.Number().default(0),
    }),
  ).default([
    { color: "rgba(255, 255, 255, 1)", position: 0 },
    { color: "rgba(255, 255, 255, 0)", position: 1 },
  ]),
}).default({});

/** Image background. Empty `url` renders as transparent. */
export const backgroundImage = Primitive.Struct({
  url: Primitive.String().default(""),
  resizeMode: Primitive.Either(
    Primitive.Literal("cover"),
    Primitive.Literal("contain"),
    Primitive.Literal("stretch"),
    Primitive.Literal("center"),
  ).default("cover"),
}).default({});

// Border
export const borderTopWidth = Primitive.Number().default(0);
export const borderRightWidth = Primitive.Number().default(0);
export const borderBottomWidth = Primitive.Number().default(0);
export const borderLeftWidth = Primitive.Number().default(0);
export const borderColor = Primitive.String()
  .default("rgba(0, 0, 0, 1)")
  .regex(RGBaRegex, "Invalid RGBA color format");
export const borderStyle = Primitive.Either(
  Primitive.Literal("solid"),
  Primitive.Literal("dashed"),
  Primitive.Literal("dotted"),
).default("solid");
export const borderTopLeftRadius = Primitive.Number().default(0);
export const borderTopRightRadius = Primitive.Number().default(0);
export const borderBottomRightRadius = Primitive.Number().default(0);
export const borderBottomLeftRadius = Primitive.Number().default(0);
export const borderEnabled = Primitive.Boolean().default(false);

// Visual
export const opacity = Primitive.Number().default(1);
export const overflow = Primitive.Either(
  Primitive.Literal("visible"),
  Primitive.Literal("hidden"),
  Primitive.Literal("scroll"),
).default("visible");
export const zIndex = Primitive.Number().default(0);
export const display = Primitive.Either(
  Primitive.Literal("flex"),
  Primitive.Literal("none"),
).default("flex");

// Shadow
export const shadowEnabled = Primitive.Boolean().default(false);
export const shadowColor = Primitive.String()
  .default("rgba(0, 0, 0, 1)")
  .regex(RGBaRegex, "Invalid RGBA color format");
export const shadowOffsetX = Primitive.Number().default(0);
export const shadowOffsetY = Primitive.Number().default(0);
export const shadowRadius = Primitive.Number().default(0);
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
  Primitive.Literal("900"),
).default("400");
export const color = Primitive.String()
  .default("rgba(0, 0, 0, 1)")
  .regex(RGBaRegex, "Invalid RGBA color format");
export const textAlign = Primitive.Either(
  Primitive.Literal("left"),
  Primitive.Literal("center"),
  Primitive.Literal("right"),
  Primitive.Literal("justify"),
).default("left");
export const lineHeight = Primitive.Number().default(1.5);
export const letterSpacing = Primitive.Number().default(0);

// Safe area
export const safeAreaTop = Primitive.Boolean().default(false);
export const safeAreaBottom = Primitive.Boolean().default(false);

// Path fill (SVG vector art) — first-class fields, not overloaded box props
export const fillColor = Primitive.String()
  .default("rgba(255, 255, 255, 1)")
  .regex(RGBaRegex, "Invalid RGBA color format");
export const fillEnabled = Primitive.Boolean().default(false);
export const fillRule = Primitive.Either(
  Primitive.Literal("nonzero"),
  Primitive.Literal("evenodd"),
).default("nonzero");
export const fillOpacity = Primitive.Number().default(1);

// Path stroke (SVG vector art)
export const strokeColor = Primitive.String()
  .default("rgba(0, 0, 0, 1)")
  .regex(RGBaRegex, "Invalid RGBA color format");
export const strokeEnabled = Primitive.Boolean().default(false);
export const strokeWidth = Primitive.Number().default(0);
export const strokeOpacity = Primitive.Number().default(1);
export const strokeLinecap = Primitive.Either(
  Primitive.Literal("butt"),
  Primitive.Literal("round"),
  Primitive.Literal("square"),
).default("butt");
export const strokeLinejoin = Primitive.Either(
  Primitive.Literal("miter"),
  Primitive.Literal("round"),
  Primitive.Literal("bevel"),
).default("miter");
