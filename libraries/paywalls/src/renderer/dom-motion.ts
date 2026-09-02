import { type RefObject, useEffect, useMemo, useRef } from "react";

import { animateMotionValue, frameDriverFromAdapter } from "../motion/animation";
import { useMotionConfig, useReducedMotion } from "../motion/context";
import { useMotionPlatform } from "../motion/platform";
import {
  resolveMotionDefinition,
  resolveMotionInitialStyle,
  resolveMotionRestStyle,
} from "../motion/resolve";
import { compileMotionCss } from "../motion/transform";
import { isMotionValue, motionValue } from "../motion/value";
import type {
  MotionLayoutBox,
  MotionNodeHandle,
  MotionStyleKey,
  MotionStyleProp,
  MotionVisualProps,
  ResolvedMotionStyle,
  ScrollViewHandle,
  Transition,
} from "../motion/types";
import { flattenStyle } from "../style/resolve";

type DomElement = HTMLDivElement | HTMLImageElement;

const layoutListeners = new Map<Element, Set<() => void>>();
let resizeObserver: ResizeObserver | undefined;

const observeLayout = (element: Element, listener: () => void): (() => void) => {
  const listeners = layoutListeners.get(element) ?? new Set<() => void>();
  listeners.add(listener);
  layoutListeners.set(element, listeners);
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver ??= new ResizeObserver((entries) => {
      for (const entry of entries) {
        for (const callback of layoutListeners.get(entry.target) ?? []) callback();
      }
    });
    resizeObserver.observe(element);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      layoutListeners.delete(element);
      resizeObserver?.unobserve(element);
    }
  };
};

const measureUntransformed = (element: HTMLElement): MotionLayoutBox => {
  let x = 0;
  let y = 0;
  let current: HTMLElement | null = element;
  while (current) {
    x += current.offsetLeft;
    y += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }
  return { height: element.offsetHeight, width: element.offsetWidth, x, y };
};

/** Builds a renderer-neutral node handle over a DOM element without exporting the DOM node. */
export const useDomNodeHandle = <T extends MotionNodeHandle = MotionNodeHandle>(
  elementRef: RefObject<DomElement | null>,
  scrollable = false,
): T => {
  const handle = useMemo(() => {
    const base: MotionNodeHandle = {
      measure: () => {
        const element = elementRef.current;
        return element ? measureUntransformed(element) : null;
      },
      subscribeLayout: (listener) => {
        const element = elementRef.current;
        return element ? observeLayout(element, listener) : () => undefined;
      },
    };
    if (!scrollable) return base as T;
    const scroll: ScrollViewHandle = {
      ...base,
      getScrollMetrics: () => {
        const element = elementRef.current;
        if (!element) {
          return {
            contentHeight: 0,
            contentWidth: 0,
            viewportHeight: 0,
            viewportWidth: 0,
            x: 0,
            y: 0,
          };
        }
        return {
          contentHeight: element.scrollHeight,
          contentWidth: element.scrollWidth,
          viewportHeight: element.clientHeight,
          viewportWidth: element.clientWidth,
          x: element.scrollLeft,
          y: element.scrollTop,
        };
      },
      scrollTo: (offset) => {
        elementRef.current?.scrollTo({ left: offset.x, top: offset.y });
      },
      subscribeScroll: (listener) => {
        const element = elementRef.current;
        if (!element) return () => undefined;
        element.addEventListener("scroll", listener, { passive: true });
        return () => element.removeEventListener("scroll", listener);
      },
    };
    return scroll as unknown as T;
  }, [elementRef, scrollable]);
  return handle;
};

const motionValuesFromStyle = (
  style: MotionStyleProp | undefined,
): Partial<Record<MotionStyleKey, ReturnType<typeof motionValue>>> => {
  const flat = flattenStyle(style as never) as Record<string, unknown>;
  const values: Partial<Record<MotionStyleKey, ReturnType<typeof motionValue>>> = {};
  for (const key of [
    "x",
    "y",
    "scale",
    "scaleX",
    "scaleY",
    "rotate",
    "opacity",
    "backgroundColor",
    "transformOrigin",
  ] as const) {
    if (isMotionValue(flat[key])) values[key] = flat[key] as ReturnType<typeof motionValue>;
  }
  return values;
};

const transitionFor = (
  transition: Transition | Record<string, Transition | undefined> | undefined,
  key: MotionStyleKey,
): Transition => {
  if (!transition) return {};
  const keyed = transition as Record<string, Transition | undefined>;
  return keyed[key] ?? keyed.default ?? transition;
};

const mergeTarget = (
  props: MotionVisualProps,
  rest: ResolvedMotionStyle,
  state: {
    readonly inView?: boolean;
    readonly pressed?: boolean;
    readonly focused?: boolean;
    readonly dragging?: boolean;
  },
): ResolvedMotionStyle => {
  const target = { ...rest };
  const definitions = [
    state.inView ? props.whileInView : undefined,
    state.pressed
      ? (props as MotionVisualProps & { whilePress?: MotionVisualProps["whileInView"] }).whilePress
      : undefined,
    state.focused
      ? (props as MotionVisualProps & { whileFocus?: MotionVisualProps["whileInView"] }).whileFocus
      : undefined,
    state.dragging
      ? (props as MotionVisualProps & { whileDrag?: MotionVisualProps["whileInView"] }).whileDrag
      : undefined,
  ];
  for (const definition of definitions) {
    Object.assign(target, resolveMotionDefinition(definition, props.variants));
  }
  return target;
};

const writeMotionStyle = (element: DomElement, style: ResolvedMotionStyle): void => {
  const css = compileMotionCss(style);
  element.style.opacity = css.opacity === undefined ? "" : String(css.opacity);
  element.style.backgroundColor =
    css.backgroundColor === undefined ? "" : String(css.backgroundColor);
  element.style.transform = css.transform === undefined ? "" : String(css.transform);
  element.style.transformOrigin =
    css.transformOrigin === undefined ? "" : String(css.transformOrigin);
};

export interface DomMotionController {
  readonly staticStyle: Record<string, string | number>;
  getVisualStyle(): ResolvedMotionStyle;
  setVisualStyle(style: Partial<ResolvedMotionStyle>): void;
  animateTo(style: Partial<ResolvedMotionStyle>, transition?: Transition): void;
  stop(): void;
}

/** Imperatively binds a primitive's motion props to one mounted DOM node. */
export const useDomMotion = (
  elementRef: RefObject<DomElement | null>,
  props: MotionVisualProps & { readonly style?: MotionStyleProp },
  state: {
    readonly inView?: boolean;
    readonly pressed?: boolean;
    readonly focused?: boolean;
    readonly dragging?: boolean;
  } = {},
): DomMotionController => {
  const config = useMotionConfig();
  const platform = useMotionPlatform();
  const reducedMotion = useReducedMotion();
  const rest = resolveMotionRestStyle(props, props.style);
  const initial = resolveMotionInitialStyle(props, props.style);
  const target = mergeTarget(props, rest, state);
  const visual = useRef<ResolvedMotionStyle>(rest);
  const stops = useRef<ReadonlyArray<() => void>>([]);
  const liveValues = motionValuesFromStyle(props.style);

  const controller = useMemo<DomMotionController>(
    () => ({
      staticStyle: compileMotionCss(rest),
      getVisualStyle: () => visual.current,
      setVisualStyle: (patch) => {
        visual.current = { ...visual.current, ...patch };
        const element = elementRef.current;
        if (element) writeMotionStyle(element, visual.current);
      },
      animateTo: (patch, transition = {}) => {
        stops.current.forEach((stop) => stop());
        const target = { ...visual.current, ...patch };
        const disposers: Array<() => void> = [];
        for (const [key, next] of Object.entries(target) as Array<
          [MotionStyleKey, ResolvedMotionStyle[MotionStyleKey]]
        >) {
          const current = visual.current[key];
          if (typeof current === "number" && typeof next === "number") {
            const value = motionValue(current);
            disposers.push(
              value.on("change", (updated) => controller.setVisualStyle({ [key]: updated })),
            );
            disposers.push(animateMotionValue(value, next, transition));
          } else {
            controller.setVisualStyle({ [key]: next });
          }
        }
        stops.current = disposers;
      },
      stop: () => {
        stops.current.forEach((stop) => stop());
        stops.current = [];
      },
    }),
    [elementRef, rest],
  );

  useEffect(() => {
    controller.stop();
    const element = elementRef.current;
    if (!element) return;
    const start = props.initial === false ? rest : initial;
    visual.current = start;
    writeMotionStyle(element, start);
    const transition = props.transition ?? config.transition;
    const disposers: Array<() => void> = [];
    let completed = false;
    const animationDefinition =
      props.animate && typeof props.animate === "object" && "start" in props.animate
        ? target
        : (props.animate ?? target);
    const finish = () => {
      if (completed) return;
      completed = true;
      props.onAnimationComplete?.(animationDefinition);
    };
    props.onAnimationStart?.(animationDefinition);
    const numericKeys = Object.entries(target).filter(
      ([key, next]) => typeof next === "number" && typeof start[key as MotionStyleKey] === "number",
    ) as Array<[MotionStyleKey, number]>;
    if (reducedMotion || numericKeys.length === 0) {
      visual.current = target;
      writeMotionStyle(element, target);
      finish();
    } else {
      let remaining = numericKeys.length;
      for (const [key, next] of numericKeys) {
        const value = motionValue(start[key] as number);
        disposers.push(
          value.on("change", (current) => controller.setVisualStyle({ [key]: current })),
        );
        disposers.push(
          animateMotionValue(
            value,
            next,
            transitionFor(transition, key),
            frameDriverFromAdapter(platform),
            false,
            () => {
              remaining -= 1;
              if (remaining === 0) {
                visual.current = target;
                writeMotionStyle(element, target);
                finish();
              }
            },
          ),
        );
      }
      for (const [key, next] of Object.entries(target) as Array<
        [MotionStyleKey, ResolvedMotionStyle[MotionStyleKey]]
      >) {
        if (typeof next !== "number" || typeof start[key] !== "number") {
          controller.setVisualStyle({ [key]: next });
        }
      }
    }
    stops.current = disposers;
    return () => {
      disposers.forEach((dispose) => dispose());
      if (stops.current === disposers) stops.current = [];
    };
  }, [config.transition, controller, initial, platform, props, reducedMotion, rest, target]);

  useEffect(() => {
    const unsubs = Object.entries(liveValues).map(([key, value]) =>
      value.on("change", (next) => {
        if (target[key as MotionStyleKey] === undefined && !reducedMotion) {
          controller.setVisualStyle({ [key]: next });
        }
      }),
    );
    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, [controller, liveValues, reducedMotion, target]);

  return controller;
};
