import { forwardRef, type ReactNode } from "react";

import { getActionName } from "../internal/action-brand";
import type { MotionNodeHandle, ScrollViewHandle } from "../motion/types";
import { useHost } from "./host-context";
import type {
  ImageProps,
  PressableProps,
  ScrollViewProps,
  TextProps,
  ViewProps,
} from "./types";

/**
 * The abstract paywall primitives. Each one resolves the active renderer and
 * mounts the matching host component, so author code never references a
 * platform directly.
 */

/** A generic flexbox container (column layout by default), like RN `View`. */
export const View = forwardRef<MotionNodeHandle, ViewProps>((props, ref): ReactNode => {
  const HostView = useHost().View;
  return <HostView {...props} ref={ref} />;
});

/** Displays text, like RN `Text`. */
export const Text = forwardRef<MotionNodeHandle, TextProps>((props, ref): ReactNode => {
  const HostText = useHost().Text;
  return <HostText {...props} ref={ref} />;
});

/**
 * A tappable surface, like RN `Pressable`. Use `onPress` for actions. When
 * `onPress` is a declared component action passed directly (e.g.
 * `onPress={actions.onSelect}`), the action name is forwarded to the host so
 * preview trees can record which action the pressable fires.
 */
export const Pressable = forwardRef<MotionNodeHandle, PressableProps>((props, ref): ReactNode => {
  const HostPressable = useHost().Pressable;
  const actionName = getActionName(props.onPress);
  return <HostPressable {...props} actionName={actionName} ref={ref} />;
});

/** A scrollable container, like RN `ScrollView`. */
export const ScrollView = forwardRef<ScrollViewHandle, ScrollViewProps>((props, ref): ReactNode => {
  const HostScrollView = useHost().ScrollView;
  return <HostScrollView {...props} ref={ref} />;
});

/** Displays an image from a URL or `{ uri }` source, like RN `Image`. */
export const Image = forwardRef<MotionNodeHandle, ImageProps>((props, ref): ReactNode => {
  const HostImage = useHost().Image;
  return <HostImage {...props} ref={ref} />;
});
