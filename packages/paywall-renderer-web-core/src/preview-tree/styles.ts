import type { Properties } from "csstype";

import { buildPreviewBackgroundStyles } from "../styles/background";
import type {
  PreviewNodeStyle,
  PreviewResolvedMotionStyle,
  PreviewResizeMode,
  StyledPreviewNodeType,
} from "./types";

/**
 * React Native `View` reset, mirrored from the OSS DOM host
 * (`@voidhash/paywalls` dom-host). Preview trees are authored with RN layout
 * expectations (column flow, no implicit shrink, border box), so the web
 * renderers re-create them instead of inheriting block-layout defaults.
 */
const VIEW_BASE: Record<string, string | number> = {
  alignItems: "stretch",
  boxSizing: "border-box",
  display: "flex",
  flexBasis: "auto",
  flexDirection: "column",
  flexShrink: 0,
  margin: 0,
  minHeight: 0,
  minWidth: 0,
  padding: 0,
  position: "relative",
};

const TEXT_BASE: Record<string, string | number> = {
  boxSizing: "border-box",
  display: "block",
  margin: 0,
  padding: 0,
  whiteSpace: "pre-wrap",
  wordWrap: "break-word",
};

const IMAGE_BASE: Record<string, string | number> = {
  boxSizing: "border-box",
  display: "block",
};

const PRESSABLE_BASE: Record<string, string | number> = {
  ...VIEW_BASE,
  cursor: "pointer",
  touchAction: "manipulation",
  userSelect: "none",
};

// Preview trees carry no `horizontal` flag, so scroll nodes always get the RN
// ScrollView default (vertical) overflow.
const SCROLL_BASE: Record<string, string | number> = {
  ...VIEW_BASE,
  overflowX: "hidden",
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
};

const BASE_BY_NODE_TYPE: Record<StyledPreviewNodeType, Record<string, string | number>> = {
  image: IMAGE_BASE,
  pressable: PRESSABLE_BASE,
  scroll: SCROLL_BASE,
  text: TEXT_BASE,
  view: VIEW_BASE,
};

/**
 * §3.1 keys that are CSS shorthands on the DOM. Committed later in an inline
 * style object they reset their longhands (`flex` clears `flexBasis`, …),
 * whereas React Native gives longhands precedence within one object regardless
 * of declaration order — so these keys are emitted before everything else. The
 * style vocabulary has no shorthand spacing/border keys (per-side longhands
 * only), so `flex` and `gap` are the only shorthands that remain.
 */
const CSS_SHORTHAND_KEYS = ["flex", "gap"] as const;

/**
 * Structured background keys the renderer consumes to derive the CSS background
 * quad (see {@link buildPreviewBackgroundStyles}) rather than emitting as raw
 * longhands. `backgroundColor` is intentionally NOT here: a `solid`/absent type
 * lets it pass through as the plain CSS property.
 */
const BACKGROUND_DERIVED_KEYS = [
  "backgroundType",
  "backgroundGradient",
  "backgroundImage",
] as const;

const SKIPPED_LONGHAND_KEYS = new Set<string>([...CSS_SHORTHAND_KEYS, ...BACKGROUND_DERIVED_KEYS]);

/**
 * Keys whose numeric values are unitless in CSS; every other numeric value is
 * an RN point and becomes `px`.
 */
const UNITLESS_KEYS = new Set<string>([
  "aspectRatio",
  "flex",
  "flexGrow",
  "flexShrink",
  "fontWeight",
  "opacity",
  "zIndex",
]);

function toCssValue(key: string, value: string | number): string | number {
  if (typeof value === "number" && !UNITLESS_KEYS.has(key)) {
    return value === 0 ? 0 : `${value}px`;
  }
  return value;
}

const RESIZE_MODE_TO_OBJECT_FIT: Record<PreviewResizeMode, Properties["objectFit"]> = {
  center: "none",
  contain: "contain",
  cover: "cover",
  stretch: "fill",
};

/**
 * Maps a preview image node's `resizeMode` to CSS `object-fit`. Mirrors the
 * OSS DOM host, including its `cover` default for an absent `resizeMode`.
 */
export function previewResizeModeToObjectFit(
  resizeMode: PreviewResizeMode | undefined,
): Properties["objectFit"] {
  return RESIZE_MODE_TO_OBJECT_FIT[resizeMode ?? "cover"];
}

/** Lowers the v2 rest-motion field using the same canonical transform ordering as the DOM host. */
export function buildPreviewMotionStyles(
  motion: PreviewResolvedMotionStyle | undefined,
): Properties {
  if (!motion) return {};
  const transforms: string[] = [];
  if (motion.x !== undefined || motion.y !== undefined) {
    transforms.push(`translate3d(${motion.x ?? 0}px, ${motion.y ?? 0}px, 0)`);
  }
  if (motion.rotate !== undefined) transforms.push(`rotate(${motion.rotate}deg)`);
  if (motion.scale !== undefined) transforms.push(`scale(${motion.scale})`);
  if (motion.scaleX !== undefined) transforms.push(`scaleX(${motion.scaleX})`);
  if (motion.scaleY !== undefined) transforms.push(`scaleY(${motion.scaleY})`);
  return {
    ...(motion.opacity === undefined ? {} : { opacity: motion.opacity }),
    ...(motion.backgroundColor === undefined ? {} : { backgroundColor: motion.backgroundColor }),
    ...(transforms.length === 0 ? {} : { transform: transforms.join(" ") }),
    ...(motion.transformOrigin === undefined
      ? {}
      : {
          transformOrigin: `${motion.transformOrigin.x * 100}% ${motion.transformOrigin.y * 100}%`,
        }),
  } as Properties;
}

/**
 * Lowers a contract §3.1 preview node style onto the web as csstype
 * `Properties`, porting the OSS DOM-host semantics:
 *
 * - per-node-type RN resets (view/pressable/scroll flex-column reset, text
 *   block reset, image block reset; pressable cursor affordances; scroll
 *   vertical overflow);
 * - deterministic specificity order — CSS shorthands (`flex`, `gap`) first,
 *   then explicit edges/corners — so RN's "longhand wins within one object"
 *   semantics hold on the DOM. Longhands already present in the node reset
 *   (`flexShrink`, `flexBasis`, …) are re-inserted at the end of the object's
 *   key order, since inline styles apply in insertion order and a
 *   reset-position longhand would otherwise lose to a later shorthand;
 * - numbers become `px` (except unitless keys), percent and other strings
 *   pass through;
 * - a per-side `border*Width`/`borderColor` without `borderStyle` implies
 *   `solid` (RN renders solid borders implicitly).
 * - a `backgroundType` of `gradient`/`image` is lowered onto the CSS background
 *   quad (SVG data-URI or `url(...)`) via {@link buildPreviewBackgroundStyles};
 *   the structured `backgroundGradient`/`backgroundImage` keys never reach the
 *   DOM as raw CSS. A `solid`/absent type leaves `backgroundColor` as-is.
 *
 * Image `object-fit` is node data, not style — see
 * {@link previewResizeModeToObjectFit}.
 */
export function buildPreviewNodeStyles(
  style: PreviewNodeStyle,
  nodeType: StyledPreviewNodeType,
  motion?: PreviewResolvedMotionStyle,
): Properties {
  const out: Record<string, string | number> = { ...BASE_BY_NODE_TYPE[nodeType] };

  // Deleting before assigning moves keys the reset already declared to the
  // end of insertion order; plain assignment would update the value but keep
  // the early reset position, letting a later shorthand clobber the longhand.
  const emitLonghand = (key: string, value: string | number) => {
    delete out[key];
    out[key] = toCssValue(key, value);
  };

  for (const key of CSS_SHORTHAND_KEYS) {
    const value = style[key];
    if (value !== undefined) {
      out[key] = toCssValue(key, value);
    }
  }

  for (const [key, value] of Object.entries(style)) {
    // Structured background values (objects) are derived below, not emitted as
    // longhands; the scalar guard both skips them and narrows the type.
    if (value === undefined || SKIPPED_LONGHAND_KEYS.has(key)) {
      continue;
    }
    if (typeof value !== "string" && typeof value !== "number") {
      continue;
    }
    emitLonghand(key, value);
  }

  const hasBorderWidth =
    style.borderTopWidth !== undefined ||
    style.borderRightWidth !== undefined ||
    style.borderBottomWidth !== undefined ||
    style.borderLeftWidth !== undefined;
  if ((hasBorderWidth || style.borderColor !== undefined) && style.borderStyle === undefined) {
    out.borderStyle = "solid";
  }

  // A gradient/image background type is lowered onto the CSS background quad,
  // overriding the pass-through `backgroundColor`. A `solid` (or absent) type
  // leaves `backgroundColor` untouched.
  if (style.backgroundType === "gradient" || style.backgroundType === "image") {
    delete out.backgroundColor;
    Object.assign(
      out,
      buildPreviewBackgroundStyles({
        backgroundColor:
          typeof style.backgroundColor === "string" ? style.backgroundColor : undefined,
        backgroundType: style.backgroundType,
        backgroundGradient: style.backgroundGradient,
        backgroundImage: style.backgroundImage,
      }),
    );
  }

  Object.assign(out, buildPreviewMotionStyles(motion));

  // Single wire→CSS boundary widening: §3.1 values arrive as string | number,
  // which cannot satisfy csstype's per-property literal unions structurally.
  return out as Properties;
}
