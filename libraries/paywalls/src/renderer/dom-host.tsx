import {
  forwardRef,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { useMotionRef } from "../motion/ref";
import { useInView } from "../motion/scroll";
import {
  MOTION_STYLE_KEYS,
  type MotionNodeHandle,
  type MotionStyleProp,
  type ScrollViewHandle,
} from "../motion/types";
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
import type { StyleProp } from "../schema/style";
import { flattenStyle, resolveStyle } from "../style/resolve";
import { useDomDrag } from "./dom-drag";
import { useDomMotion, useDomNodeHandle } from "./dom-motion";

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

const RESIZE_MODE_TO_OBJECT_FIT: Record<ResizeMode, CSSProperties["objectFit"]> = {
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

const resolveStaticStyle = (style: MotionStyleProp | undefined): CSSProperties => {
  const flat = { ...(flattenStyle(style as never) as Record<string, unknown>) };
  for (const key of MOTION_STYLE_KEYS) delete flat[key];
  return resolveStyle(flat as StyleProp);
};

const useViewMotion = (
  elementRef: RefObject<HTMLDivElement | HTMLImageElement | null>,
  props: ViewProps | TextProps | ImageProps | PressableHostProps | ScrollViewProps,
  handle: MotionNodeHandle,
  state: {
    readonly pressed?: boolean;
    readonly focused?: boolean;
    readonly dragging?: boolean;
  } = {},
) => {
  const motionRef = useMotionRef<MotionNodeHandle>();
  motionRef.current = handle;
  const inView = useInView(motionRef, props.viewport);
  return useDomMotion(elementRef, props, { ...state, inView });
};

const DomView = forwardRef<MotionNodeHandle, ViewProps>((props, ref): ReactNode => {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const handle = useDomNodeHandle(elementRef);
  useImperativeHandle(ref, () => handle, [handle]);
  const [dragging, setDragging] = useState(false);
  const motion = useViewMotion(elementRef, props, handle, { dragging });
  const drag = useDomDrag(elementRef, handle, props, motion, {
    onEnd: () => setDragging(false),
    onStart: () => setDragging(true),
  });

  return (
    <div
      aria-label={props.accessibilityLabel}
      data-testid={props.testID}
      onPointerCancel={(event) => drag.onPointerCancel(event)}
      onPointerDown={(event) => drag.onPointerDown(event)}
      onPointerMove={(event) => drag.onPointerMove(event)}
      onPointerUp={(event) => drag.onPointerUp(event)}
      ref={elementRef}
      style={{
        ...VIEW_BASE,
        ...resolveStaticStyle(props.style),
        ...motion.staticStyle,
        touchAction: drag.touchAction,
      }}
    >
      {props.children}
    </div>
  );
});

const DomText = forwardRef<MotionNodeHandle, TextProps>((props, ref): ReactNode => {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const handle = useDomNodeHandle(elementRef);
  useImperativeHandle(ref, () => handle, [handle]);
  const motion = useViewMotion(elementRef, props, handle);
  return (
    <div
      aria-label={props.accessibilityLabel}
      data-testid={props.testID}
      ref={elementRef}
      style={{
        ...TEXT_BASE,
        ...lineClampStyle(props.numberOfLines),
        ...resolveStaticStyle(props.style),
        ...motion.staticStyle,
      }}
    >
      {props.children}
    </div>
  );
});

const DomPressable = forwardRef<MotionNodeHandle, PressableHostProps>((props, ref): ReactNode => {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const handle = useDomNodeHandle(elementRef);
  useImperativeHandle(ref, () => handle, [handle]);
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const cancelledPress = useRef(false);
  const motion = useViewMotion(elementRef, props, handle, { dragging, focused, pressed });
  const drag = useDomDrag(elementRef, handle, props, motion, {
    onEnd: () => setDragging(false),
    onStart: () => {
      cancelledPress.current = true;
      setDragging(true);
      setPressed(false);
    },
  });
  const handleActivate = () => {
    if (!props.disabled) props.onPress?.();
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (props.disabled) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleActivate();
    }
  };

  return (
    <div
      aria-disabled={props.disabled || undefined}
      aria-label={props.accessibilityLabel}
      data-pressed={pressed || undefined}
      data-testid={props.testID}
      onBlur={() => setFocused(false)}
      onClick={(event) => {
        if (cancelledPress.current) {
          cancelledPress.current = false;
          event.preventDefault();
          return;
        }
        handleActivate();
      }}
      onFocus={() => setFocused(true)}
      onKeyDown={handleKeyDown}
      onPointerCancel={(event) => {
        setPressed(false);
        drag.onPointerCancel(event);
      }}
      onPointerDown={(event) => {
        if (!props.disabled) setPressed(true);
        drag.onPointerDown(event);
      }}
      onPointerLeave={() => setPressed(false)}
      onPointerMove={(event) => drag.onPointerMove(event)}
      onPointerUp={(event) => {
        setPressed(false);
        drag.onPointerUp(event);
      }}
      ref={elementRef}
      role="button"
      style={{
        ...VIEW_BASE,
        cursor: props.disabled ? "default" : "pointer",
        opacity: props.disabled ? 0.5 : undefined,
        touchAction: drag.touchAction,
        userSelect: "none",
        ...resolveStaticStyle(props.style),
        ...motion.staticStyle,
      }}
      tabIndex={props.disabled ? -1 : 0}
    >
      {typeof props.children === "function" ? props.children({ pressed }) : props.children}
    </div>
  );
});

const DomScrollView = forwardRef<ScrollViewHandle, ScrollViewProps>((props, ref): ReactNode => {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const handle = useDomNodeHandle<ScrollViewHandle>(elementRef, true);
  useImperativeHandle(ref, () => handle, [handle]);
  const motion = useViewMotion(elementRef, props, handle);
  return (
    <div
      data-testid={props.testID}
      data-vh-scroll-axis={props.horizontal ? "x" : "y"}
      ref={elementRef}
      style={{
        ...VIEW_BASE,
        flexDirection: props.horizontal ? "row" : "column",
        overflowX: props.horizontal ? "auto" : "hidden",
        overflowY: props.horizontal ? "hidden" : "auto",
        WebkitOverflowScrolling: "touch",
        ...resolveStaticStyle(props.style),
        ...motion.staticStyle,
      }}
    >
      <div
        style={{
          ...VIEW_BASE,
          flexDirection: props.horizontal ? "row" : "column",
          flexGrow: 1,
          flexShrink: 0,
          ...resolveStyle(props.contentContainerStyle),
        }}
      >
        {props.children}
      </div>
    </div>
  );
});

const DomImage = forwardRef<MotionNodeHandle, ImageProps>((props, ref): ReactNode => {
  const elementRef = useRef<HTMLImageElement | null>(null);
  const handle = useDomNodeHandle(elementRef);
  useImperativeHandle(ref, () => handle, [handle]);
  const [dragging, setDragging] = useState(false);
  const motion = useViewMotion(elementRef, props, handle, { dragging });
  const drag = useDomDrag(elementRef, handle, props, motion, {
    onEnd: () => setDragging(false),
    onStart: () => setDragging(true),
  });
  return (
    <img
      alt={props.accessibilityLabel ?? ""}
      data-testid={props.testID}
      draggable={false}
      onPointerCancel={(event) => drag.onPointerCancel(event)}
      onPointerDown={(event) => drag.onPointerDown(event)}
      onPointerMove={(event) => drag.onPointerMove(event)}
      onPointerUp={(event) => drag.onPointerUp(event)}
      ref={elementRef}
      src={resolveImageSource(props.source)}
      style={{
        boxSizing: "border-box",
        display: "block",
        objectFit: RESIZE_MODE_TO_OBJECT_FIT[props.resizeMode ?? "cover"],
        touchAction: drag.touchAction,
        ...resolveStaticStyle(props.style),
        ...motion.staticStyle,
      }}
    />
  );
});

const DomSlot = ({ children, fallback }: SlotHostProps): ReactNode => children ?? fallback ?? null;

/** The DOM implementation of the {@link HostComponents} contract. */
export const domHostComponents: HostComponents = {
  Image: DomImage,
  Pressable: DomPressable,
  ScrollView: DomScrollView,
  Slot: DomSlot,
  Text: DomText,
  View: DomView,
};
