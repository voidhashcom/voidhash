"use client";

import { useEffect, useRef } from "react";

import {
  advanceWorkingIndicator,
  createWorkingIndicatorAnimation,
  forEachWorkingIndicatorDot,
  getWorkingIndicatorDotRadius,
  setWorkingIndicatorActive,
  syncWorkingIndicatorScreens,
} from "@/features/studio/paywalls/designer/canvas/overlay/working-indicator-animation";

const BLUE_RIBBON_600 = 0x06_73_ff;

/** Room around the screen for the three dot rows that sit outside it. */
const PADDING = 44;

interface WorkingIndicatorProps {
  /** Whether the agent is mid-session; drives the entry and exit sweeps. */
  active: boolean;
  /** Screen size in paywall coordinates. */
  height: number;
  width: number;
  /** Factor the paywall is displayed at, so dot size tracks the canvas zoom. */
  scale: number;
}

/**
 * The designer's "agent is working" indicator, rendered over the landing page's paywall.
 *
 * Shares the exact animation module the real canvas overlay uses, so the marketing
 * illustration and the product stay in step. Pixi is imported on demand to keep it out
 * of the marketing bundle.
 */
export function WorkingIndicator({ active, height, scale, width }: WorkingIndicatorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  const startRef = useRef<(() => void) | null>(null);

  activeRef.current = active;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let disposed = false;
    let dispose: (() => void) | null = null;

    const initialize = async () => {
      const { Application, Graphics } = await import("pixi.js");
      if (disposed) {
        return;
      }

      const app = new Application();
      await app.init({
        antialias: true,
        autoDensity: true,
        backgroundAlpha: 0,
        height: height * scale + PADDING * 2,
        resolution: window.devicePixelRatio || 1,
        width: width * scale + PADDING * 2,
      });

      if (disposed) {
        app.destroy(true, { children: true });
        return;
      }

      app.canvas.style.display = "block";
      host.append(app.canvas);

      const graphics = new Graphics();
      graphics.eventMode = "none";
      app.stage.addChild(graphics);

      const animation = createWorkingIndicatorAnimation({ scale, x: PADDING, y: PADDING });
      syncWorkingIndicatorScreens(animation, [{ height, id: "paywall", width, x: 0, y: 0 }]);

      const tick = (ticker: { deltaMS: number }) => {
        const now = performance.now();
        setWorkingIndicatorActive(animation, activeRef.current, now);
        advanceWorkingIndicator(animation, now, ticker.deltaMS);

        graphics.clear();
        forEachWorkingIndicatorDot(animation, (dot, viewport) => {
          if (dot.alpha <= 0.001) {
            return;
          }

          const radius = getWorkingIndicatorDotRadius(dot, viewport.scale);
          graphics.circle(dot.x, dot.y, radius);
          graphics.fill({ alpha: dot.alpha * 0.24, color: 0xff_ff_ff });
          if (dot.proximity > 0.001) {
            graphics.circle(dot.x, dot.y, radius);
            graphics.fill({ alpha: dot.alpha * dot.proximity * 0.96, color: BLUE_RIBBON_600 });
          }
        });

        if (animation.phase === "idle" && !activeRef.current) {
          app.stop();
          app.render();
        }
      };

      app.ticker.add(tick);
      startRef.current = () => app.start();
      if (activeRef.current) {
        app.start();
      } else {
        app.stop();
        app.render();
      }

      dispose = () => {
        startRef.current = null;
        app.ticker.remove(tick);
        app.destroy(true, { children: true });
      };
    };

    void initialize();

    return () => {
      disposed = true;
      dispose?.();
    };
  }, [height, scale, width]);

  useEffect(() => {
    if (active) {
      startRef.current?.();
    }
  }, [active]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute"
      ref={hostRef}
      style={{ left: -PADDING, top: -PADDING }}
    />
  );
}
