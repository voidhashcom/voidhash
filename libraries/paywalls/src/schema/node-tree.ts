/**
 * The §3 preview node tree — the closed-primitive serialization of a component
 * SSR-ed at CLI build time against a preview state's fixtures. Never HTML.
 * Servers validate uploaded trees against exactly these shapes.
 */
import type { PaywallStyle } from "./style";

/** Wire version of the preview node tree format. */
export const PAYWALL_TREE_VERSION = 1 as const;

/** How an image node fills its frame. Mirrors RN `resizeMode`. */
export type PaywallNodeResizeMode = "cover" | "contain" | "stretch" | "center";

export interface PaywallViewNode {
  readonly type: "view";
  readonly style: PaywallStyle;
  readonly children: ReadonlyArray<PaywallNode>;
}

export interface PaywallPressableNode {
  readonly type: "pressable";
  readonly style: PaywallStyle;
  readonly children: ReadonlyArray<PaywallNode>;
  /** The declared action name this pressable fires, when known. */
  readonly action?: string;
}

export interface PaywallScrollNode {
  readonly type: "scroll";
  readonly style: PaywallStyle;
  readonly children: ReadonlyArray<PaywallNode>;
}

export interface PaywallTextNode {
  readonly type: "text";
  readonly style: PaywallStyle;
  readonly text: string;
}

export interface PaywallImageNode {
  readonly type: "image";
  readonly style: PaywallStyle;
  readonly src: string;
  readonly resizeMode?: PaywallNodeResizeMode;
}

/** Marker where the editor mounts consumer children. At most one per tree. */
export interface PaywallSlotNode {
  readonly type: "slot";
}

/** Emitted where rendering failed or produced nothing renderable. */
export interface PaywallPlaceholderNode {
  readonly type: "placeholder";
  readonly reason: string;
}

export type PaywallNode =
  | PaywallViewNode
  | PaywallPressableNode
  | PaywallScrollNode
  | PaywallTextNode
  | PaywallImageNode
  | PaywallSlotNode
  | PaywallPlaceholderNode;

/** A rendered preview tree artifact (`previews/<state>.json`). */
export interface PaywallNodeTree {
  readonly treeVersion: typeof PAYWALL_TREE_VERSION;
  /** The preview state this tree was rendered for, e.g. `"default"`. */
  readonly state: string;
  readonly root: PaywallNode;
}
