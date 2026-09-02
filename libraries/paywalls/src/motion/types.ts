import type { PaywallStyle } from "../schema/style";
import type { MotionValue } from "./value";

/** The compositor-safe keys supported by the first motion release. */
export const MOTION_STYLE_KEYS = [
  "x",
  "y",
  "scale",
  "scaleX",
  "scaleY",
  "rotate",
  "opacity",
  "backgroundColor",
  "transformOrigin",
] as const;

export type MotionStyleKey = (typeof MOTION_STYLE_KEYS)[number];

/** A logical transform origin, expressed as fractions of the rendered box. */
export interface MotionTransformOrigin {
  readonly x: number;
  readonly y: number;
}

/** A serializable, resolved visual state. This is the only motion data in preview trees. */
export interface ResolvedMotionStyle {
  readonly x?: number;
  readonly y?: number;
  readonly scale?: number;
  readonly scaleX?: number;
  readonly scaleY?: number;
  readonly rotate?: number;
  readonly opacity?: number;
  readonly backgroundColor?: string;
  readonly transformOrigin?: MotionTransformOrigin;
}

type MotionValueOr<T> = T | MotionValue<T>;

/** Motion values that may be supplied through a primitive's `style` prop. */
export interface MotionStyle {
  readonly x?: MotionValueOr<number>;
  readonly y?: MotionValueOr<number>;
  readonly scale?: MotionValueOr<number>;
  readonly scaleX?: MotionValueOr<number>;
  readonly scaleY?: MotionValueOr<number>;
  readonly rotate?: MotionValueOr<number>;
  readonly opacity?: MotionValueOr<number>;
  readonly backgroundColor?: MotionValueOr<string>;
  readonly transformOrigin?: MotionValueOr<MotionTransformOrigin>;
}

/** The RN-compatible static style plus the limited motion output vocabulary. */
export type MotionStyleObject = Omit<PaywallStyle, keyof MotionStyle> & MotionStyle;

export type MotionStyleProp =
  | MotionStyleObject
  | false
  | null
  | undefined
  | ReadonlyArray<MotionStyleProp>;

/** A named visual state used by `variants`, `animate`, and interaction props. */
export type MotionTarget = ResolvedMotionStyle;

export type VariantLabel = string | ReadonlyArray<string>;

export type EasingDefinition = "linear" | "easeIn" | "easeOut" | "easeInOut";

/** Parameters shared by tween and spring motion transitions. */
export interface Transition {
  readonly type?: "tween" | "spring";
  readonly delay?: number;
  readonly duration?: number;
  readonly ease?: EasingDefinition;
  readonly stiffness?: number;
  readonly damping?: number;
  readonly mass?: number;
  readonly velocity?: number;
  readonly restDelta?: number;
  readonly restSpeed?: number;
}

/** A transition with optional per-motion-key overrides. */
export type TransitionByKey = Transition & Partial<Record<MotionStyleKey | "default", Transition>>;

/** A future-compatible imperative animation controller. */
export interface AnimationControls {
  start(definition: MotionTarget | VariantLabel): void;
  stop(): void;
}

/** Geometry options shared by `whileInView` and `useInView`. */
export interface ViewportOptions {
  readonly once?: boolean;
  readonly amount?: number | "some" | "all";
  readonly margin?: string;
  readonly root?: MotionRef<MotionNodeHandle>;
}

/** Common visual props accepted by every renderable primitive. */
export interface MotionVisualProps {
  readonly initial?: false | MotionTarget | VariantLabel;
  readonly animate?: MotionTarget | VariantLabel | AnimationControls;
  readonly variants?: Readonly<Record<string, MotionTarget>>;
  readonly transition?: Transition | TransitionByKey;
  readonly whileInView?: MotionTarget | VariantLabel;
  readonly viewport?: ViewportOptions;
  readonly onAnimationStart?: (definition: MotionTarget | VariantLabel) => void;
  readonly onAnimationComplete?: (definition: MotionTarget | VariantLabel) => void;
}

/** Motion interactions supplied only by `Pressable`. */
export interface PressableMotionProps {
  readonly whilePress?: MotionTarget | VariantLabel;
  readonly whileFocus?: MotionTarget | VariantLabel;
}

export type DragAxis = true | "x" | "y";

/** A layout box in logical pixels. */
export interface MotionLayoutBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Platform-neutral pointer data delivered to drag callbacks and controls. */
export interface MotionGestureEvent {
  readonly point: { readonly x: number; readonly y: number };
  readonly pointerId: number;
  readonly timeStamp: number;
}

/** Platform-neutral drag data in logical pixels. */
export interface DragInfo {
  readonly point: { readonly x: number; readonly y: number };
  readonly delta: { readonly x: number; readonly y: number };
  readonly offset: { readonly x: number; readonly y: number };
  readonly velocity: { readonly x: number; readonly y: number };
}

/** Explicit logical bounds for a draggable element. */
export interface DragConstraints {
  readonly left?: number;
  readonly right?: number;
  readonly top?: number;
  readonly bottom?: number;
}

/** Renderer-neutral node registration used by refs, scroll, and constraints. */
export interface MotionNodeHandle {
  measure(): MotionLayoutBox | null;
  subscribeLayout(listener: () => void): () => void;
}

/** A node handle that can provide logical scroll metrics and events. */
export interface ScrollViewHandle extends MotionNodeHandle {
  getScrollMetrics(): MotionScrollMetrics;
  scrollTo(offset: { readonly x?: number; readonly y?: number }): void;
  subscribeScroll(listener: () => void): () => void;
}

/** Scroll offsets and dimensions, all in logical pixels. */
export interface MotionScrollMetrics {
  readonly x: number;
  readonly y: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly contentWidth: number;
  readonly contentHeight: number;
}

/** A renderer-neutral mutable ref populated by motion-capable primitives. */
export interface MotionRef<T extends MotionNodeHandle = MotionNodeHandle> {
  current: T | null;
}

/** Options for tracking a root or nested scroll container. */
export interface UseScrollOptions {
  readonly container?: MotionRef<ScrollViewHandle>;
  readonly target?: MotionRef<MotionNodeHandle>;
  readonly axis?: "x" | "y";
  readonly offset?: readonly [string, string];
  readonly trackLayout?: boolean;
}

/** Scroll motion values. Both axes are returned for composability. */
export interface ScrollMotionValues {
  readonly scrollX: MotionValue<number>;
  readonly scrollY: MotionValue<number>;
  readonly scrollXProgress: MotionValue<number>;
  readonly scrollYProgress: MotionValue<number>;
}

/** Imperative controls associated with one draggable primitive. */
export interface DragControls {
  start(
    event: MotionGestureEvent,
    options?: { readonly snapToCursor?: boolean; readonly distanceThreshold?: number },
  ): void;
}

/** Touch-first drag props accepted only by View, Image, and Pressable. */
export interface DraggableMotionProps {
  readonly drag?: DragAxis;
  readonly dragConstraints?: DragConstraints | MotionRef<MotionNodeHandle>;
  readonly dragElastic?: boolean | number;
  readonly dragMomentum?: boolean;
  readonly dragTransition?: Transition;
  readonly dragDirectionLock?: boolean;
  readonly dragListener?: boolean;
  readonly dragControls?: DragControls;
  readonly gesturePriority?: "auto" | "drag";
  readonly whileDrag?: MotionTarget | VariantLabel;
  readonly onDragStart?: (event: MotionGestureEvent, info: DragInfo) => void;
  readonly onDrag?: (event: MotionGestureEvent, info: DragInfo) => void;
  readonly onDragEnd?: (event: MotionGestureEvent, info: DragInfo) => void;
}

/** Reduced-motion policy inherited by a `MotionConfig` subtree. */
export type ReducedMotion = "user" | "always" | "never";

/** Configuration inherited by a motion subtree. */
export interface MotionConfigProps {
  readonly reducedMotion?: ReducedMotion;
  readonly transition?: Transition | TransitionByKey;
  readonly children?: import("react").ReactNode;
}

/** The small platform boundary motion needs from a host renderer. */
export interface MotionPlatformAdapter {
  requestFrame(callback: (time: number) => void): number;
  cancelFrame(frame: number): void;
  now(): number;
  prefersReducedMotion(): boolean;
}
