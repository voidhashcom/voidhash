import { useEffect, useState } from "react";

import { useMotionValue } from "./hooks";
import type {
  MotionLayoutBox,
  MotionNodeHandle,
  MotionRef,
  MotionScrollMetrics,
  ScrollMotionValues,
  ScrollViewHandle,
  UseScrollOptions,
  ViewportOptions,
} from "./types";

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

const rootMetrics = (): MotionScrollMetrics => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { contentHeight: 0, contentWidth: 0, viewportHeight: 0, viewportWidth: 0, x: 0, y: 0 };
  }
  const root = document.documentElement;
  return {
    contentHeight: Math.max(root.scrollHeight, document.body?.scrollHeight ?? 0),
    contentWidth: Math.max(root.scrollWidth, document.body?.scrollWidth ?? 0),
    viewportHeight: window.innerHeight,
    viewportWidth: window.innerWidth,
    x: window.scrollX,
    y: window.scrollY,
  };
};

const parseAnchor = (value: string, size: number): number => {
  if (value === "start") return 0;
  if (value === "center") return size / 2;
  if (value === "end") return size;
  if (value.endsWith("%")) return (Number.parseFloat(value) / 100) * size;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const targetProgress = (
  metrics: MotionScrollMetrics,
  target: MotionLayoutBox,
  container: MotionLayoutBox | null,
  axis: "x" | "y",
  offsets: readonly [string, string],
): number => {
  const isX = axis === "x";
  const targetStart = isX ? target.x : target.y;
  const targetSize = isX ? target.width : target.height;
  const containerStart = container ? (isX ? container.x : container.y) : 0;
  const viewportSize = isX ? metrics.viewportWidth : metrics.viewportHeight;
  const scroll = isX ? metrics.x : metrics.y;
  const points = offsets.map((offset) => {
    const [targetAnchor = "start", containerAnchor = "start"] = offset.trim().split(/\s+/);
    return (
      targetStart -
      containerStart +
      parseAnchor(targetAnchor, targetSize) -
      parseAnchor(containerAnchor, viewportSize)
    );
  });
  const span = points[1]! - points[0]!;
  return span === 0 ? 0 : clamp((scroll - points[0]!) / span);
};

/** Tracks root or nested-scroll positions and progress in logical pixels. */
export const useScroll = (options: UseScrollOptions = {}): ScrollMotionValues => {
  const scrollX = useMotionValue(0);
  const scrollY = useMotionValue(0);
  const scrollXProgress = useMotionValue(0);
  const scrollYProgress = useMotionValue(0);
  const axis = options.axis ?? "y";
  const offsets = options.offset ?? ["start end", "end start"];

  useEffect(() => {
    const container = options.container?.current;
    const target = options.target?.current;
    let pending = false;
    let frame: number | undefined;
    const read = () => {
      pending = false;
      const metrics = container?.getScrollMetrics() ?? rootMetrics();
      scrollX.set(metrics.x);
      scrollY.set(metrics.y);
      const containerBox = container?.measure() ?? null;
      const targetBox = target?.measure() ?? null;
      if (targetBox) {
        const progress = targetProgress(metrics, targetBox, containerBox, axis, offsets);
        if (axis === "x") scrollXProgress.set(progress);
        else scrollYProgress.set(progress);
      } else {
        scrollXProgress.set(
          metrics.contentWidth <= metrics.viewportWidth
            ? 0
            : clamp(metrics.x / (metrics.contentWidth - metrics.viewportWidth)),
        );
        scrollYProgress.set(
          metrics.contentHeight <= metrics.viewportHeight
            ? 0
            : clamp(metrics.y / (metrics.contentHeight - metrics.viewportHeight)),
        );
      }
    };
    const schedule = () => {
      if (pending) return;
      pending = true;
      if (typeof requestAnimationFrame === "undefined") {
        queueMicrotask(read);
      } else {
        frame = requestAnimationFrame(read);
      }
    };
    read();
    const subscriptions = [
      container?.subscribeScroll(schedule),
      options.trackLayout ? container?.subscribeLayout(schedule) : undefined,
      options.trackLayout ? target?.subscribeLayout(schedule) : undefined,
    ].filter((unsubscribe): unsubscribe is () => void => unsubscribe !== undefined);
    if (!container && typeof window !== "undefined") {
      window.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("resize", schedule);
      subscriptions.push(() => {
        window.removeEventListener("scroll", schedule);
        window.removeEventListener("resize", schedule);
      });
    }
    return () => {
      if (frame !== undefined && typeof cancelAnimationFrame !== "undefined")
        cancelAnimationFrame(frame);
      subscriptions.forEach((unsubscribe) => unsubscribe());
    };
  }, [
    axis,
    offsets,
    options.container,
    options.target,
    options.trackLayout,
    scrollX,
    scrollXProgress,
    scrollY,
    scrollYProgress,
  ]);

  return { scrollX, scrollXProgress, scrollY, scrollYProgress };
};

const intersectionRatio = (target: MotionLayoutBox, root: MotionLayoutBox): number => {
  const left = Math.max(target.x, root.x);
  const top = Math.max(target.y, root.y);
  const right = Math.min(target.x + target.width, root.x + root.width);
  const bottom = Math.min(target.y + target.height, root.y + root.height);
  const area = Math.max(0, right - left) * Math.max(0, bottom - top);
  const targetArea = target.width * target.height;
  return targetArea === 0 ? 0 : area / targetArea;
};

/** Returns whether a motion node is in view, updating only when the boolean changes. */
export const useInView = (
  ref: MotionRef<MotionNodeHandle>,
  options: ViewportOptions = {},
): boolean => {
  const [inView, setInView] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);

  useEffect(() => {
    const target = ref.current;
    const root = options.root?.current;
    if (!target) return;
    const threshold =
      options.amount === "all" ? 1 : options.amount === "some" ? 0.01 : (options.amount ?? 0);
    const read = () => {
      const targetBox = target.measure();
      const rootBox =
        root?.measure() ??
        (typeof window === "undefined"
          ? null
          : { height: window.innerHeight, width: window.innerWidth, x: 0, y: 0 });
      if (!targetBox || !rootBox) return;
      const next = intersectionRatio(targetBox, rootBox) >= threshold;
      if (options.once && hasEntered) return;
      setInView(next);
      if (next) setHasEntered(true);
    };
    read();
    const unsubscribes = [target.subscribeLayout(read), root?.subscribeLayout(read)].filter(
      (unsubscribe): unsubscribe is () => void => unsubscribe !== undefined,
    );
    if (root && "subscribeScroll" in root) {
      unsubscribes.push((root as unknown as ScrollViewHandle).subscribeScroll(read));
    } else if (!root && typeof window !== "undefined") {
      window.addEventListener("scroll", read, { passive: true });
      window.addEventListener("resize", read);
      unsubscribes.push(() => {
        window.removeEventListener("scroll", read);
        window.removeEventListener("resize", read);
      });
    }
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [hasEntered, options.amount, options.once, options.root, ref]);

  return inView;
};
