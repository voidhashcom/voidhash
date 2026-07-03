/**
 * Host components for the preview-tree target. Each primitive lowers to an
 * internal intrinsic element (`vh-view`, `vh-text`, …) that the custom
 * reconciler turns into §3 nodes. Interaction state is static: pressables
 * render their non-pressed children, scroll views render flat.
 */
import { createElement, type ReactNode } from "react";

import type {
  HostComponents,
  ImageProps,
  PressableHostProps,
  ScrollViewProps,
  SlotHostProps,
  TextProps,
  ViewProps,
} from "../primitives/types";
import { resolveImageSource } from "../renderer/dom-host";
import type { StyleProp } from "../schema/style";
import { flattenStyle } from "../style/resolve";

/** Intrinsic element names understood by the tree reconciler. */
export const TREE_ELEMENT_TYPES = {
  image: "vh-image",
  placeholder: "vh-placeholder",
  pressable: "vh-pressable",
  scroll: "vh-scroll",
  slot: "vh-slot",
  text: "vh-text",
  view: "vh-view",
} as const;

const hasStyleKeys = (style: StyleProp): boolean => Object.keys(flattenStyle(style)).length > 0;

const TreeView = ({ style, children }: ViewProps): ReactNode =>
  createElement(TREE_ELEMENT_TYPES.view, { style }, children);

const TreeText = ({ style, children }: TextProps): ReactNode =>
  createElement(TREE_ELEMENT_TYPES.text, { style }, children);

const TreePressable = ({ style, children, actionName, onPress }: PressableHostProps): ReactNode =>
  // `actionName` (a direct `onPress={actions.onSelect}` binding) carries the
  // action name safely. The raw `onPress` is forwarded untouched so the
  // serializer can probe an inline handler (`onPress={() => actions.onSelect(…)}`)
  // for its action name AFTER the render has committed — never during render,
  // where invoking the author's handler could schedule state updates and
  // corrupt the tree (see `resolvePressableAction`).
  createElement(
    TREE_ELEMENT_TYPES.pressable,
    { action: actionName, onPress, style },
    typeof children === "function" ? children({ pressed: false }) : children,
  );

const TreeScrollView = ({
  style,
  contentContainerStyle,
  horizontal,
  children,
}: ScrollViewProps): ReactNode =>
  createElement(
    TREE_ELEMENT_TYPES.scroll,
    // §3 scroll nodes carry no `horizontal` key; the axis is expressed
    // through the style subset instead.
    { style: horizontal ? [{ flexDirection: "row" as const }, style] : style },
    // RN's contentContainerStyle has no §3 equivalent — preserve it as an
    // inner view when it actually styles something.
    hasStyleKeys(contentContainerStyle)
      ? createElement(TREE_ELEMENT_TYPES.view, { style: contentContainerStyle }, children)
      : children,
  );

const TreeImage = ({ style, source, resizeMode }: ImageProps): ReactNode =>
  createElement(TREE_ELEMENT_TYPES.image, {
    resizeMode,
    src: resolveImageSource(source),
    style,
  });

const TreeSlot = ({ children }: SlotHostProps): ReactNode =>
  // No consumer children → emit the slot marker so the editor knows where to
  // mount its own (the author fallback is a runtime-only affordance).
  children ?? createElement(TREE_ELEMENT_TYPES.slot);

/** The preview-tree implementation of the {@link HostComponents} contract. */
export const treeHostComponents: HostComponents = {
  Image: TreeImage,
  Pressable: TreePressable,
  ScrollView: TreeScrollView,
  Slot: TreeSlot,
  Text: TreeText,
  View: TreeView,
};
