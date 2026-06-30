import type { ReactNode } from "react";

import { getActionName } from "../internal/action-brand";
import { useHost } from "./host-context";
import type { ImageProps, PressableProps, ScrollViewProps, TextProps, ViewProps } from "./types";

/**
 * The abstract paywall primitives. Each one resolves the active renderer and
 * mounts the matching host component, so author code never references a
 * platform directly.
 */

/** A generic flexbox container (column layout by default), like RN `View`. */
export const View = (props: ViewProps): ReactNode => {
  const HostView = useHost().View;
  return <HostView {...props} />;
};

/** Displays text, like RN `Text`. */
export const Text = (props: TextProps): ReactNode => {
  const HostText = useHost().Text;
  return <HostText {...props} />;
};

/**
 * A tappable surface, like RN `Pressable`. Use `onPress` for actions. When
 * `onPress` is a declared component action passed directly (e.g.
 * `onPress={actions.onSelect}`), the action name is forwarded to the host so
 * preview trees can record which action the pressable fires.
 */
export const Pressable = (props: PressableProps): ReactNode => {
  const HostPressable = useHost().Pressable;
  const actionName = getActionName(props.onPress);
  return <HostPressable {...props} actionName={actionName} />;
};

/** A scrollable container, like RN `ScrollView`. */
export const ScrollView = (props: ScrollViewProps): ReactNode => {
  const HostScrollView = useHost().ScrollView;
  return <HostScrollView {...props} />;
};

/** Displays an image from a URL or `{ uri }` source, like RN `Image`. */
export const Image = (props: ImageProps): ReactNode => {
  const HostImage = useHost().Image;
  return <HostImage {...props} />;
};
