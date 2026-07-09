/**
 * Host components for the preview-tree target. Each primitive lowers to an
 * internal intrinsic element (`vh-view`, `vh-text`, …) that the custom
 * reconciler turns into §3 nodes. Interaction state is static: pressables
 * render their non-pressed children, scroll views render flat.
 */
import { createElement, forwardRef, type ReactNode } from "react";

import { resolveMotionRestStyle } from "../motion/resolve";
import type { MotionNodeHandle, MotionStyleProp, MotionVisualProps, ScrollViewHandle } from "../motion/types";
import { staticMotionPlatformAdapter } from "../motion/platform";
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

const hasStyleKeys = (style: StyleProp): boolean =>
  Object.keys(flattenStyle(style)).length > 0;

const withMotion = <Props extends MotionVisualProps & { style?: MotionStyleProp }>(props: Props) => {
  const motion = resolveMotionRestStyle(props, props.style);
  return Object.keys(motion).length === 0 ? {} : { motion };
};

const TreeView = forwardRef<MotionNodeHandle, ViewProps>(({ style, children, ...props }, _ref): ReactNode =>
  createElement(TREE_ELEMENT_TYPES.view, { style, ...withMotion({ ...props, style }) }, children),
);

const TreeText = forwardRef<MotionNodeHandle, TextProps>(({ style, children, ...props }, _ref): ReactNode =>
  createElement(TREE_ELEMENT_TYPES.text, { style, ...withMotion({ ...props, style }) }, children),
);

const TreePressable = forwardRef<MotionNodeHandle, PressableHostProps>(({
  style,
  children,
  actionName,
  ...props
}, _ref): ReactNode =>
  createElement(
    TREE_ELEMENT_TYPES.pressable,
    { action: actionName, style, ...withMotion({ ...props, style }) },
    typeof children === "function" ? children({ pressed: false }) : children,
  ),
);

const TreeScrollView = forwardRef<ScrollViewHandle, ScrollViewProps>(({
  style,
  contentContainerStyle,
  horizontal,
  children,
  ...props
}, _ref): ReactNode =>
  createElement(
    TREE_ELEMENT_TYPES.scroll,
    // §3 scroll nodes carry no `horizontal` key; the axis is expressed
    // through the style subset instead.
    {
      style: horizontal ? [{ flexDirection: "row" as const }, style] : style,
      ...withMotion({ ...props, style }),
    },
    // RN's contentContainerStyle has no §3 equivalent — preserve it as an
    // inner view when it actually styles something.
    hasStyleKeys(contentContainerStyle)
      ? createElement(
          TREE_ELEMENT_TYPES.view,
          { style: contentContainerStyle },
          children,
        )
      : children,
  ),
);

const TreeImage = forwardRef<MotionNodeHandle, ImageProps>(({ style, source, resizeMode, ...props }, _ref): ReactNode =>
  createElement(TREE_ELEMENT_TYPES.image, {
    ...withMotion({ ...props, style }),
    resizeMode,
    src: resolveImageSource(source),
    style,
  }),
);

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

/** The tree host's synchronous rest-state adapter. It never schedules live animation. */
export { staticMotionPlatformAdapter };
