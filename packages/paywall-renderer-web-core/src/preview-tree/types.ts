/**
 * Render-side mirrors of the paywall-deploy-contract §3 preview node tree.
 *
 * These are aliases of the OSS single source of truth, `@voidhash/paywalls/schema`
 * (the `Paywall*` node/style types + `PAYWALL_TREE_VERSION`), so the render side
 * never drifts from the authoring library. The one deliberate widening: the OSS
 * `PaywallStyle` uses precise per-key literal unions (`flexDirection?: "row" | …`,
 * `flex?: number`, …), whereas the render side treats every §3.1 style value as
 * `string | number` ({@link PreviewNodeStyle}). This keeps the render side a
 * strict superset of both OSS `PaywallStyle` and `@voidhash/core`'s
 * effect-Schema `PreviewStyle` (whose decoded values are also `string | number`),
 * so a core-decoded tree stays structurally assignable to {@link PreviewTree}.
 * Validation is the server's job (`PreviewTreeSchema` in `@voidhash/core`);
 * these types exist so renderers do not depend on `effect` or the server.
 */

import type {
  PaywallBackgroundType,
  PaywallNodeResizeMode,
  PaywallPlaceholderNode,
  PaywallSlotNode,
  PaywallStyle,
} from "@voidhash/paywalls/schema";

/**
 * §3 preview node tree wire versions accepted during the motion rollout.
 * Version 1 omits motion; version 2 adds resolved rest-state motion fields.
 */
export type PreviewTreeVersion = 1 | 2;

/** §3.1 style value — a color/length string or a device-independent pixel number. */
export type PreviewStyleValue = string | number;

/**
 * The §3.1 style keys whose value is a structured object rather than a scalar:
 * the gradient/image background descriptors. Their decoded shape is preserved
 * (an OSS-built preview tree carries plain objects here, not CRDT envelopes), so
 * {@link buildPreviewNodeStyles} can lower them onto the CSS background quad.
 */
type PreviewStructuredStyleKey = "backgroundType" | "backgroundGradient" | "backgroundImage";

/** A gradient color stop — an RGBA color at a normalized `0..1` position. */
export interface PreviewGradientStop {
  readonly color: string;
  readonly position: number;
}

/**
 * A gradient background descriptor. Structurally a superset of both OSS
 * `PaywallBackgroundGradient` (mutable `stops`) and `@voidhash/core`'s
 * effect-decoded gradient (`readonly` `stops`) — `stops` is `readonly` here so
 * either assigns in, keeping {@link PreviewNodeStyle} a strict superset of both.
 */
export interface PreviewBackgroundGradient {
  readonly kind: "linear" | "radial";
  readonly startX: number;
  readonly startY: number;
  readonly endX: number;
  readonly endY: number;
  readonly stops: ReadonlyArray<PreviewGradientStop>;
}

/** An image background descriptor. Superset of the OSS/core image shapes. */
export interface PreviewBackgroundImage {
  readonly url: string;
  readonly resizeMode: "cover" | "contain" | "stretch" | "center";
}

/**
 * Contract §3.1 RN-compatible style subset. Keyed to the OSS {@link PaywallStyle}
 * vocabulary (a key added or removed there flows here automatically). Scalar
 * values are widened to {@link PreviewStyleValue} so wire/`effect`-decoded trees
 * — whose style values arrive as `string | number` — remain assignable; the
 * three structured background keys keep their object shape (widened to
 * `readonly` so both OSS and core's decoded gradient assign in).
 */
export type PreviewNodeStyle = {
  readonly [K in keyof PaywallStyle as K extends PreviewStructuredStyleKey ? never : K]?:
    | PreviewStyleValue
    | undefined;
} & {
  readonly backgroundType?: PaywallBackgroundType | undefined;
  readonly backgroundGradient?: PreviewBackgroundGradient | undefined;
  readonly backgroundImage?: PreviewBackgroundImage | undefined;
};

/** How an image node fills its frame. Exact alias of the OSS resize mode. */
export type PreviewResizeMode = PaywallNodeResizeMode;

/** One resolved, serializable rest visual state from a v2 preview artifact. */
export interface PreviewResolvedMotionStyle {
  readonly x?: number | undefined;
  readonly y?: number | undefined;
  readonly scale?: number | undefined;
  readonly scaleX?: number | undefined;
  readonly scaleY?: number | undefined;
  readonly rotate?: number | undefined;
  readonly opacity?: number | undefined;
  readonly backgroundColor?: string | undefined;
  readonly transformOrigin?: { readonly x: number; readonly y: number } | undefined;
}

export interface PreviewViewNode {
  readonly type: "view";
  readonly style: PreviewNodeStyle;
  readonly motion?: PreviewResolvedMotionStyle | undefined;
  readonly children: ReadonlyArray<PreviewNode>;
}

export interface PreviewPressableNode {
  readonly type: "pressable";
  readonly style: PreviewNodeStyle;
  readonly motion?: PreviewResolvedMotionStyle | undefined;
  readonly children: ReadonlyArray<PreviewNode>;
  /** The declared component action name this pressable fires. */
  readonly action?: string | undefined;
}

export interface PreviewScrollNode {
  readonly type: "scroll";
  readonly style: PreviewNodeStyle;
  readonly motion?: PreviewResolvedMotionStyle | undefined;
  readonly children: ReadonlyArray<PreviewNode>;
}

export interface PreviewTextNode {
  readonly type: "text";
  readonly style: PreviewNodeStyle;
  readonly motion?: PreviewResolvedMotionStyle | undefined;
  readonly text: string;
}

export interface PreviewImageNode {
  readonly type: "image";
  readonly style: PreviewNodeStyle;
  readonly motion?: PreviewResolvedMotionStyle | undefined;
  readonly src: string;
  readonly resizeMode?: PreviewResizeMode | undefined;
}

/** Slot marker — the editor mounts the component node's children here. Alias of the OSS node. */
export type PreviewSlotNode = PaywallSlotNode;

/** Emitted where rendering failed or produced nothing renderable. Alias of the OSS node. */
export type PreviewPlaceholderNode = PaywallPlaceholderNode;

/** Closed contract §3 node union. */
export type PreviewNode =
  | PreviewViewNode
  | PreviewPressableNode
  | PreviewScrollNode
  | PreviewTextNode
  | PreviewImageNode
  | PreviewSlotNode
  | PreviewPlaceholderNode;

/** The §3 `previews/<state>.json` artifact: a tree of closed primitives. */
export interface PreviewTree {
  readonly treeVersion: PreviewTreeVersion;
  readonly state: string;
  readonly root: PreviewNode;
}

/** Preview node types that carry a `style` field. */
export type StyledPreviewNodeType = "view" | "pressable" | "scroll" | "text" | "image";
