"use client";

import { cn, Logo } from "@voidhash/ui";
import { motion, useMotionValue, useMotionValueEvent, useTransform } from "motion/react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

import { ASTEROIDS_STAGE_CLASS } from "../asteroids/frame";

/**
 * The game must cost nothing until someone actually plays it: the engine, the CRT shader and the
 * chrome live in their own chunk, and nothing mounts — no canvas, no loop — until the play button
 * is pressed. The chunk itself is only prefetched once the finale scrolls near.
 */
const AsteroidsGame = lazy(async () => ({
  default: (await import("../asteroids/game")).AsteroidsGame,
}));

/** How far ahead of the viewport the chunk starts downloading. */
const PREFETCH_MARGIN = "600px";

/** Scroll progress past which the play button is interactive and armed for the keyboard. */
const REVEAL_PROGRESS = 0.6;

/**
 * The section is one viewport taller than the sticky stage inside it, so the last stretch of the
 * page scrubs the logo-to-play transition instead of flipping it: the giant wordmark dissolves as
 * the extra viewport scrolls by, and the unexplained play button condenses out of the same scroll.
 * Once pressed, the stage swaps to the live game.
 */
export function LandingAsteroids() {
  const sectionRef = useRef<HTMLElement>(null);
  const [stage, setStage] = useState<"scroll" | "game">("scroll");
  const [revealed, setRevealed] = useState(false);

  // Progress through the runway, computed by hand: how far the extra viewport of section has been
  // scrolled past the point where the sticky stage pins.
  const scrollProgress = useMotionValue(0);
  const logoOpacity = useTransform(scrollProgress, [0, 0.5], [1, 0]);
  const logoScale = useTransform(scrollProgress, [0, 0.5], [1, 0.96]);
  const logoLift = useTransform(scrollProgress, [0, 0.5], [0, -48]);
  const buttonOpacity = useTransform(scrollProgress, [0.45, 0.85], [0, 1]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || stage !== "scroll") {
      return;
    }

    // Geometry is cached outside the scroll handler: reading offsets on every scroll event can
    // force a reflow mid-scroll, janking the very scrub the handler drives.
    let runway = 0;
    let sectionTop = 0;

    const update = () => {
      const raw = runway > 0 ? (window.scrollY - sectionTop) / runway : 1;
      scrollProgress.set(Math.min(1, Math.max(0, raw)));
    };

    const measure = () => {
      runway = section.offsetHeight - window.innerHeight;
      sectionTop = section.offsetTop;
      update();
    };

    measure();
    // The section sits at the very bottom of the page, so anything above it resizing (images
    // loading, fonts swapping) moves its offset.
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(document.body);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", measure);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", measure);
    };
  }, [scrollProgress, stage]);

  // Interactivity needs a boolean, not a motion value: the button must ignore clicks and focus
  // while it is still invisible mid-scrub.
  useMotionValueEvent(scrollProgress, "change", (progress) => {
    setRevealed(progress >= REVEAL_PROGRESS);
  });

  // Warm the chunk once the finale approaches, so pressing play starts the game instantly.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          import("../asteroids/game");
          observer.disconnect();
        }
      },
      { rootMargin: PREFETCH_MARGIN },
    );
    observer.observe(section);

    return () => observer.disconnect();
  }, []);

  // Once the button has condensed in, the keys that scrolled here also press it.
  useEffect(() => {
    if (stage !== "scroll" || !revealed) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.code === "Enter") {
        event.preventDefault();
        setStage("game");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [revealed, stage]);

  return (
    <section className="relative h-[200svh] w-full self-stretch bg-zinc-950" ref={sectionRef}>
      <div className="sticky top-0 h-svh w-full overflow-hidden">
        {stage === "game" ? (
          <Suspense fallback={<div className={ASTEROIDS_STAGE_CLASS} />}>
            <AsteroidsGame autoStart />
          </Suspense>
        ) : (
          <>
            <motion.div
              className="absolute inset-x-0 top-0 flex justify-center px-6 pt-16 md:px-12 md:pt-20 xl:px-32"
              style={{ opacity: logoOpacity, scale: logoScale, y: logoLift }}
            >
              {/* The Logo default carries `dark:text-white`, so the dark override must be explicit. */}
              <Logo className="h-auto w-full max-w-[1656px] text-zinc-800 dark:text-zinc-800" />
            </motion.div>
            <motion.div
              className={cn(
                "absolute inset-0 flex items-center justify-center",
                !revealed && "pointer-events-none",
              )}
              style={{ opacity: buttonOpacity }}
            >
              <button
                className="border border-zinc-500 px-10 py-3.5 font-mono text-sm text-white tracking-[0.25em] transition-colors hover:border-white hover:bg-white hover:text-black"
                onClick={() => setStage("game")}
                tabIndex={revealed ? 0 : -1}
                type="button"
              >
                PLAY
              </button>
            </motion.div>
          </>
        )}
      </div>
    </section>
  );
}
