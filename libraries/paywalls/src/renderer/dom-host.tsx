import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useState,
} from "react";

import type {
  HostComponents,
  ImageProps,
  ImageSource,
  PressableHostProps,
  ResizeMode,
  ScrollViewProps,
  SlotHostProps,
  TextProps,
  ViewProps,
} from "../primitives/types";
import { resolveStyle } from "../style/resolve";

/**
 * Flexbox defaults that mirror React Native's `View` reset. Authoring code is
 * written with RN layout expectations (column flow, no implicit shrink, border
 * box), so the DOM renderer re-creates them rather than inheriting the
 * browser's block-layout defaults.
 */
const VIEW_BASE: CSSProperties = {
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

const TEXT_BASE: CSSProperties = {
  boxSizing: "border-box",
  display: "block",
  margin: 0,
  padding: 0,
  whiteSpace: "pre-wrap",
  wordWrap: "break-word",
};

const RESIZE_MODE_TO_OBJECT_FIT: Record<
  ResizeMode,
  CSSProperties["objectFit"]
> = {
  center: "none",
  contain: "contain",
  cover: "cover",
  stretch: "fill",
};

/** Resolves an {@link ImageSource} to its URL. */
export const resolveImageSource = (source: ImageSource): string =>
  typeof source === "string" ? source : source.uri;

const lineClampStyle = (numberOfLines?: number): CSSProperties =>
  numberOfLines && numberOfLines > 0
    ? {
        display: "-webkit-box",
        overflow: "hidden",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: numberOfLines,
      }
    : {};

const DomView = ({
  style,
  children,
  testID,
  accessibilityLabel,
}: ViewProps): ReactNode => (
  <div
    aria-label={accessibilityLabel}
    data-testid={testID}
    style={{ ...VIEW_BASE, ...resolveStyle(style) }}
  >
    {children}
  </div>
);

const DomText = ({
  style,
  children,
  numberOfLines,
  testID,
  accessibilityLabel,
}: TextProps): ReactNode => (
  <div
    aria-label={accessibilityLabel}
    data-testid={testID}
    style={{
      ...TEXT_BASE,
      ...lineClampStyle(numberOfLines),
      ...resolveStyle(style),
    }}
  >
    {children}
  </div>
);

const DomPressable = ({
  style,
  children,
  onPress,
  disabled,
  testID,
  accessibilityLabel,
}: PressableHostProps): ReactNode => {
  const [pressed, setPressed] = useState(false);

  const handleActivate = () => {
    if (disabled) {
      return;
    }
    onPress?.();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleActivate();
    }
  };

  return (
    <div
      aria-disabled={disabled || undefined}
      aria-label={accessibilityLabel}
      data-pressed={pressed || undefined}
      data-testid={testID}
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
      onPointerCancel={() => setPressed(false)}
      onPointerDown={() => setPressed(true)}
      onPointerLeave={() => setPressed(false)}
      onPointerUp={() => setPressed(false)}
      role="button"
      style={{
        ...VIEW_BASE,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        touchAction: "manipulation",
        userSelect: "none",
        ...resolveStyle(style),
      }}
      tabIndex={disabled ? -1 : 0}
    >
      {typeof children === "function" ? children({ pressed }) : children}
    </div>
  );
};

const DomScrollView = ({
  style,
  contentContainerStyle,
  horizontal,
  children,
  testID,
}: ScrollViewProps): ReactNode => (
  <div
    data-testid={testID}
    style={{
      ...VIEW_BASE,
      flexDirection: horizontal ? "row" : "column",
      overflowX: horizontal ? "auto" : "hidden",
      overflowY: horizontal ? "hidden" : "auto",
      WebkitOverflowScrolling: "touch",
      ...resolveStyle(style),
    }}
  >
    <div
      style={{
        ...VIEW_BASE,
        flexDirection: horizontal ? "row" : "column",
        flexGrow: 1,
        flexShrink: 0,
        ...resolveStyle(contentContainerStyle),
      }}
    >
      {children}
    </div>
  </div>
);

const DomImage = ({
  style,
  source,
  resizeMode = "cover",
  accessibilityLabel,
  testID,
}: ImageProps): ReactNode => (
  <img
    alt={accessibilityLabel ?? ""}
    data-testid={testID}
    src={resolveImageSource(source)}
    style={{
      boxSizing: "border-box",
      display: "block",
      objectFit: RESIZE_MODE_TO_OBJECT_FIT[resizeMode],
      ...resolveStyle(style),
    }}
  />
);

const DomSlot = ({ children, fallback }: SlotHostProps): ReactNode =>
  children ?? fallback ?? null;

/** The DOM implementation of the {@link HostComponents} contract. */
export const domHostComponents: HostComponents = {
  Image: DomImage,
  Pressable: DomPressable,
  ScrollView: DomScrollView,
  Slot: DomSlot,
  Text: DomText,
  View: DomView,
};
