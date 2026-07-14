"use client";

import { Application, Graphics, type Ticker } from "pixi.js";
import { useEffect, useRef } from "react";

import { selectRenderRoot, usePaywallDesignerStore } from "../../state/designer-store";
import type { DesignerStoreState } from "../../state/designer-store-state";
import {
  advanceWorkingIndicator,
  createWorkingIndicatorAnimation,
  forEachWorkingIndicatorDot,
  getWorkingIndicatorDotRadius,
  setWorkingIndicatorActive,
  syncWorkingIndicatorScreens,
  updateWorkingIndicatorViewport,
  type WorkingIndicatorScreen,
} from "./working-indicator-animation";

const BLUE_RIBBON_600 = 0x06_73_ff;

const readScreens = (state: DesignerStoreState): WorkingIndicatorScreen[] => {
  const root = selectRenderRoot(state);
  return root.children.flatMap((node) => {
    if (node.type !== "screen") {
      return [];
    }
    const bounds = state.canvas.boundingBoxes[node.id];
    return bounds ? [{ id: node.id, ...bounds }] : [];
  });
};

interface WorkingIndicatorOverlayProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/** Renders the designer agent's working animation in a Pixi GPU overlay. */
export function WorkingIndicatorOverlay({ containerRef }: WorkingIndicatorOverlayProps) {
  const store = usePaywallDesignerStore();
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const resizeTarget = containerRef.current;
    if (!host) {
      return;
    }

    const app = new Application();
    let initialized = false;
    let mounted = true;
    let unsubscribe: (() => void) | null = null;
    let tick: ((ticker: Ticker) => void) | null = null;

    const initialize = async () => {
      await app.init({
        antialias: true,
        autoDensity: true,
        backgroundAlpha: 0,
        resizeTo: resizeTarget ?? undefined,
        resolution: window.devicePixelRatio || 1,
      });

      if (!mounted) {
        app.destroy(true, { children: true });
        return;
      }

      initialized = true;
      app.canvas.style.display = "block";
      host.append(app.canvas);

      const graphics = new Graphics();
      graphics.eventMode = "none";
      app.stage.addChild(graphics);
      const animation = createWorkingIndicatorAnimation();

      tick = (ticker) => {
        const state = store.getState() as DesignerStoreState;
        const viewport = state.canvas;
        const now = performance.now();
        updateWorkingIndicatorViewport(animation, {
          scale: viewport.scale,
          x: viewport.x,
          y: viewport.y,
        });
        syncWorkingIndicatorScreens(animation, readScreens(state));
        setWorkingIndicatorActive(animation, state.ai.isWorking, now);
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
            graphics.fill({
              alpha: dot.alpha * dot.proximity * 0.96,
              color: BLUE_RIBBON_600,
            });
          }
        });

        if (animation.phase === "idle" && !state.ai.isWorking) {
          app.stop();
          app.render();
        }
      };

      app.ticker.add(tick);
      unsubscribe = store.subscribe((state, previousState) => {
        if (state.ai.isWorking !== previousState.ai.isWorking) {
          app.start();
        }
      });

      if (store.getState().ai.isWorking) {
        app.start();
      } else {
        app.stop();
        app.render();
      }
    };

    initialize();

    return () => {
      mounted = false;
      unsubscribe?.();
      if (!initialized) {
        return;
      }
      if (tick) {
        app.ticker.remove(tick);
      }
      app.destroy(true, { children: true });
    };
  }, [containerRef, store]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      ref={hostRef}
      style={{ zIndex: 9 }}
    />
  );
}
