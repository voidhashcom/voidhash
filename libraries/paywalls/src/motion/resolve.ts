import { flattenStyle } from "../style/resolve";
import { isMotionValue } from "./value";
import {
  MOTION_STYLE_KEYS,
  type AnimationControls,
  type MotionStyleProp,
  type MotionTarget,
  type MotionVisualProps,
  type ResolvedMotionStyle,
  type VariantLabel,
} from "./types";

const isAnimationControls = (value: unknown): value is AnimationControls =>
  typeof value === "object" && value !== null && "start" in value && "stop" in value;

/** Resolves an inline target or one or more named variants. */
export const resolveMotionDefinition = (
  definition: MotionTarget | VariantLabel | AnimationControls | false | undefined,
  variants: MotionVisualProps["variants"],
): MotionTarget | undefined => {
  if (!definition || isAnimationControls(definition)) {
    return undefined;
  }
  const labels =
    typeof definition === "string"
      ? [definition]
      : Array.isArray(definition)
        ? definition
        : undefined;
  if (!labels) return definition as MotionTarget;
  return labels.reduce<MotionTarget>(
    (target, label) => ({
      ...target,
      ...variants?.[label],
    }),
    {},
  );
};

/** Resolves literal motion style values, deliberately excluding live values from static artifacts. */
export const resolveLiteralMotionStyle = (
  style: MotionStyleProp | undefined,
): ResolvedMotionStyle => {
  const flat = flattenStyle(style as never) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of MOTION_STYLE_KEYS) {
    const value = flat[key];
    if (value !== undefined && !isMotionValue(value)) {
      out[key] = value;
    }
  }
  return out as ResolvedMotionStyle;
};

/** Resolves a primitive's deterministic rest visual state for static hosts. */
export const resolveMotionRestStyle = (
  props: Pick<MotionVisualProps, "animate" | "initial" | "variants">,
  style: MotionStyleProp | undefined,
): ResolvedMotionStyle => {
  const animate = resolveMotionDefinition(props.animate, props.variants);
  const initial = resolveMotionDefinition(props.initial, props.variants);
  return {
    ...resolveLiteralMotionStyle(style),
    ...(animate ?? initial),
  };
};

/** Resolves the visual state that should be mounted before an enter animation begins. */
export const resolveMotionInitialStyle = (
  props: Pick<MotionVisualProps, "animate" | "initial" | "variants">,
  style: MotionStyleProp | undefined,
): ResolvedMotionStyle => ({
  ...resolveLiteralMotionStyle(style),
  ...resolveMotionDefinition(props.initial, props.variants),
});
