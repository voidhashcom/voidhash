"use client";

import { cn } from "@voidhash/ui";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { type AsteroidsAction, AsteroidsEngine, type AsteroidsStatus } from "./engine";
import { ASTEROIDS_STAGE_CLASS } from "./frame";
import { createCrtCompositor } from "./post";

/** Keyed by `KeyboardEvent.code`, so the layout works the same on QWERTZ and AZERTY. */
const KEY_ACTIONS: Record<string, AsteroidsAction> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "thrust",
  KeyA: "left",
  KeyD: "right",
  KeyW: "thrust",
  Space: "fire",
};

const BEST_SCORE_KEY = "voidhash.asteroids.best";

function readBestScore(): number {
  try {
    return Number(window.localStorage.getItem(BEST_SCORE_KEY)) || 0;
  } catch {
    // Private-mode Safari and blocked-storage setups throw on access; a missing high score is not
    // worth breaking the game over.
    return 0;
  }
}

function writeBestScore(score: number): void {
  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(score));
  } catch {
    // Ignored for the same reason as above.
  }
}

function pad(value: number, digits: number): string {
  return String(value).padStart(digits, "0");
}

function ShipGlyph({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 12 14" width="11">
      <path d="M6 1 11 13 6 10.2 1 13Z" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  );
}

const HUD_ALIGN = {
  center: "items-center",
  end: "items-end",
  start: "items-start",
} as const;

function HudStat({
  align = "start",
  label,
  children,
}: {
  align?: keyof typeof HUD_ALIGN;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1", HUD_ALIGN[align])}>
      <div className="text-[11px]/3.5 text-zinc-600 tracking-[0.06em]">{label}</div>
      <div className="text-white text-xl/6 tabular-nums">{children}</div>
    </div>
  );
}

function TouchButton({
  className,
  label,
  onHold,
  children,
}: {
  className?: string;
  label: string;
  onHold: (pressed: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        "flex size-14 items-center justify-center rounded-full border border-zinc-700 bg-black/50 font-mono text-zinc-300 active:border-zinc-400 active:text-white",
        className,
      )}
      onContextMenu={(event) => event.preventDefault()}
      onPointerCancel={() => onHold(false)}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      type="button"
    >
      {children}
    </button>
  );
}

/**
 * Full-screen playable board for the landing page's unexplained finale.
 *
 * Owns the canvases and the arcade chrome; all simulation lives in {@link AsteroidsEngine} and the
 * CRT look in the `post` shader pass. The loop is gated on the board being on screen in a visible
 * tab, and a run that scrolls out of view pauses itself so the page never quietly holds the arrow
 * keys hostage. With `autoStart` the run begins the moment the board has a size — the section only
 * mounts this component once the player has already pressed play.
 */
export function AsteroidsGame({ autoStart = false }: { autoStart?: boolean }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AsteroidsEngine | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const [status, setStatus] = useState<AsteroidsStatus>("idle");
  const [hud, setHud] = useState({ lives: 3, score: 0, wave: 1 });
  const [bestScore, setBestScore] = useState(0);
  const [showTouchControls, setShowTouchControls] = useState(false);

  useEffect(() => {
    setBestScore(readBestScore());
    setShowTouchControls(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!(frame && canvas)) {
      return;
    }

    // With the CRT pass the visible canvas is WebGL and the engine draws into an offscreen scene;
    // without it the engine draws straight onto the visible canvas.
    const compositor = createCrtCompositor(canvas, prefersReducedMotion === true);
    const engine = new AsteroidsEngine({
      canvas: compositor ? document.createElement("canvas") : canvas,
      compositor,
      onHud: setHud,
      onStatus: setStatus,
      reducedMotion: prefersReducedMotion === true,
    });
    engineRef.current = engine;

    let onScreen = false;
    const syncActive = () => engine.setActive(onScreen && !document.hidden);

    let started = false;
    const resizeObserver = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      engine.resize(Math.round(box.width), Math.round(box.height));
      if (autoStart && !started && box.width > 0) {
        started = true;
        engine.start();
      }
    });
    resizeObserver.observe(frame);

    // A run that leaves the viewport pauses rather than merely freezing, so the overlay tells the
    // player why the ship stopped — and so the key handler unbinds with it.
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        if (!onScreen) {
          engine.pause();
        }
        syncActive();
      },
      { threshold: 0.35 },
    );
    intersectionObserver.observe(frame);

    const onVisibilityChange = () => {
      if (document.hidden) {
        engine.pause();
      }
      syncActive();
    };
    const onBlur = () => engine.pause();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);

    return () => {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      engine.destroy();
      compositor?.destroy();
      engineRef.current = null;
    };
  }, [autoStart, prefersReducedMotion]);

  // Bound only while a run is live: the arrow keys and space belong to the page the rest of the
  // time, and an unbound handler cannot swallow a scroll.
  useEffect(() => {
    if (status !== "playing") {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (event.code === "Escape") {
        engineRef.current?.pause();
        return;
      }
      // ArrowDown/S do nothing but must not scroll the page away from a live game.
      if (event.code === "ArrowDown" || event.code === "KeyS") {
        event.preventDefault();
        return;
      }
      const action = KEY_ACTIONS[event.code];
      if (!action) {
        return;
      }
      event.preventDefault();
      engineRef.current?.setInput(action, true);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const action = KEY_ACTIONS[event.code];
      if (action) {
        event.preventDefault();
        engineRef.current?.setInput(action, false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      for (const action of ["left", "right", "thrust", "fire"] as const) {
        engineRef.current?.setInput(action, false);
      }
    };
  }, [status]);

  // Space/Enter starts or resumes a run, but only while the board fills the view — half a screen
  // up the page those keys still belong to scrolling.
  useEffect(() => {
    if (status === "playing") {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.code !== "Space" && event.code !== "Enter") ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }
      const rect = frameRef.current?.getBoundingClientRect();
      const midscreen = window.innerHeight * 0.5;
      if (!rect || rect.top > midscreen || rect.bottom < midscreen) {
        return;
      }
      event.preventDefault();
      if (status === "paused") {
        engineRef.current?.resume();
      } else {
        engineRef.current?.start();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status]);

  useEffect(() => {
    if (status === "over" && hud.score > bestScore) {
      setBestScore(hud.score);
      writeBestScore(hud.score);
    }
  }, [bestScore, hud.score, status]);

  const hold = useCallback((action: AsteroidsAction, pressed: boolean) => {
    engineRef.current?.setInput(action, pressed);
  }, []);

  const primaryAction = useCallback(() => {
    if (status === "paused") {
      engineRef.current?.resume();
    } else {
      engineRef.current?.start();
    }
  }, [status]);

  return (
    <div className={cn(ASTEROIDS_STAGE_CLASS, "select-none font-mono")} ref={frameRef}>
      <canvas className="block size-full" ref={canvasRef} />

      {/* The landing navbar stays sticky over the stage, so the HUD starts below it. */}
      <div className="pointer-events-none absolute inset-x-0 top-20 flex items-start justify-between px-6 md:px-10">
        <HudStat label="SCORE">{pad(hud.score, 6)}</HudStat>
        <HudStat align="center" label="WAVE">
          {pad(hud.wave, 2)}
        </HudStat>
        <HudStat align="end" label="SHIPS">
          <div className="flex h-6 items-center gap-1.5">
            {hud.lives > 0 ? (
              Array.from({ length: hud.lives }, (_, index) => <ShipGlyph key={index} />)
            ) : (
              <span className="text-zinc-600">—</span>
            )}
          </div>
        </HudStat>
      </div>

      <div className="pointer-events-none absolute bottom-5 left-6 text-[11px]/3.5 text-zinc-700 tracking-[0.06em] md:left-10">
        HI {pad(Math.max(bestScore, hud.score), 6)}
      </div>

      {showTouchControls && status === "playing" ? (
        <>
          <div className="absolute bottom-8 left-6 flex gap-3">
            <TouchButton label="Rotate left" onHold={(down) => hold("left", down)}>
              <span aria-hidden="true">◀</span>
            </TouchButton>
            <TouchButton label="Rotate right" onHold={(down) => hold("right", down)}>
              <span aria-hidden="true">▶</span>
            </TouchButton>
          </div>
          <div className="absolute right-6 bottom-8 flex gap-3">
            <TouchButton label="Thrust" onHold={(down) => hold("thrust", down)}>
              <span aria-hidden="true">▲</span>
            </TouchButton>
            <TouchButton
              className="border-blue-ribbon-600/70 text-blue-ribbon-400"
              label="Fire"
              onHold={(down) => hold("fire", down)}
            >
              <span aria-hidden="true">●</span>
            </TouchButton>
          </div>
        </>
      ) : null}

      {/* No idle overlay: with autoStart the run begins before a frame of idle is ever visible. */}
      {status === "paused" || status === "over" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-10 bg-black/55 px-6 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="text-4xl text-white tracking-[0.3em] md:text-6xl">
              {status === "paused" ? "PAUSED" : "GAME OVER"}
            </div>
            {status === "over" ? (
              <div className="text-[15px] text-zinc-400 tabular-nums tracking-[0.1em]">
                SCORE {pad(hud.score, 6)}
                {hud.score > 0 && hud.score >= bestScore ? " · NEW RECORD" : ""}
              </div>
            ) : null}
          </div>
          <button
            className="border border-zinc-500 px-10 py-3.5 text-sm text-white tracking-[0.25em] transition-colors hover:border-white hover:bg-white hover:text-black"
            onClick={primaryAction}
            type="button"
          >
            {status === "paused" ? "RESUME" : "PLAY AGAIN"}
          </button>
          {showTouchControls ? null : (
            <div className="animate-pulse text-[12px] text-zinc-500 tracking-[0.25em]">
              {status === "paused" ? "PRESS SPACE TO RESUME" : "PRESS SPACE TO PLAY AGAIN"}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
