import type { ResolvedMotionStyle } from "./types";

/** Compiles a resolved motion transform in the canonical cross-renderer order. */
export const compileMotionTransform = (style: ResolvedMotionStyle): string | undefined => {
  const transforms: string[] = [];
  if (style.x !== undefined || style.y !== undefined) {
    transforms.push(`translate3d(${style.x ?? 0}px, ${style.y ?? 0}px, 0)`);
  }
  if (style.rotate !== undefined) {
    transforms.push(`rotate(${style.rotate}deg)`);
  }
  if (style.scale !== undefined) {
    transforms.push(`scale(${style.scale})`);
  }
  if (style.scaleX !== undefined) {
    transforms.push(`scaleX(${style.scaleX})`);
  }
  if (style.scaleY !== undefined) {
    transforms.push(`scaleY(${style.scaleY})`);
  }
  return transforms.length === 0 ? undefined : transforms.join(" ");
};

/** Lowers resolved motion into the narrow visual CSS output owned by adapters. */
export const compileMotionCss = (style: ResolvedMotionStyle): Record<string, string | number> => {
  const transform = compileMotionTransform(style);
  return {
    ...(style.opacity === undefined ? {} : { opacity: style.opacity }),
    ...(style.backgroundColor === undefined ? {} : { backgroundColor: style.backgroundColor }),
    ...(transform === undefined ? {} : { transform }),
    ...(style.transformOrigin === undefined
      ? {}
      : { transformOrigin: `${style.transformOrigin.x * 100}% ${style.transformOrigin.y * 100}%` }),
  };
};
