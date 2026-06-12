import type { ReactNode } from "react";

import type { StyleProp } from "../schema/style";

/** Interaction state passed to a {@link PressableProps} render-prop child. */
export interface PressableState {
  readonly pressed: boolean;
}

/** A resolvable image source — a remote/asset URL or a `{ uri }` object. */
export type ImageSource = string | { readonly uri: string };

/** How an {@link ImageProps} image fills its frame. Mirrors RN `resizeMode`. */
export type ResizeMode = "cover" | "contain" | "stretch" | "center";

export interface ViewProps {
  style?: StyleProp;
  children?: ReactNode;
  /** Stable identifier for testing / analytics targeting. */
  testID?: string;
  /** Accessibility label surfaced to screen readers. */
  accessibilityLabel?: string;
}

export interface TextProps {
  style?: StyleProp;
  children?: ReactNode;
  /** Truncate to N lines with an ellipsis. `0`/undefined means unlimited. */
  numberOfLines?: number;
  testID?: string;
  accessibilityLabel?: string;
}

export interface PressableProps {
  style?: StyleProp;
  /** Static children, or a render-prop receiving the {@link PressableState}. */
  children?: ReactNode | ((state: PressableState) => ReactNode);
  /**
   * Fired on tap/click. The primary action hook for a paywall button. The
   * `never[]` rest signature accepts any callback — including declared
   * component actions passed directly (`onPress={actions.onSelect}`), which is
   * how preview trees learn the action a pressable fires. Note that a
   * direct-passed payload action receives no payload from a raw press; the
   * visual editor supplies payload bindings itself.
   */
  onPress?: (...args: never[]) => void;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}

export interface ScrollViewProps {
  style?: StyleProp;
  /** Style applied to the inner content wrapper (RN `contentContainerStyle`). */
  contentContainerStyle?: StyleProp;
  /** Scroll on the x-axis instead of the y-axis. */
  horizontal?: boolean;
  children?: ReactNode;
  testID?: string;
}

export interface ImageProps {
  style?: StyleProp;
  source: ImageSource;
  resizeMode?: ResizeMode;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * Host-facing pressable props. `actionName` is threaded by the abstract
 * `Pressable` when its `onPress` is a declared component action, so the tree
 * renderer can record which action a pressable fires.
 */
export interface PressableHostProps extends PressableProps {
  actionName?: string;
}

/**
 * Host-facing slot props. `children` are the consumer-provided children of the
 * enclosing component (or `null` when none were passed); `fallback` is the
 * author-declared fallback content.
 */
export interface SlotHostProps {
  children?: ReactNode;
  fallback?: ReactNode;
}

/**
 * The set of host components a renderer must provide. The abstract primitives
 * exported from `@voidhash/paywalls` resolve their implementation from the
 * active renderer via this contract, which is what lets the same paywall tree
 * target the DOM, the preview node tree, and native views later.
 */
export interface HostComponents {
  View: (props: ViewProps) => ReactNode;
  Text: (props: TextProps) => ReactNode;
  Pressable: (props: PressableHostProps) => ReactNode;
  ScrollView: (props: ScrollViewProps) => ReactNode;
  Image: (props: ImageProps) => ReactNode;
  Slot: (props: SlotHostProps) => ReactNode;
}
