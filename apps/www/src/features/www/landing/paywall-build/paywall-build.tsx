"use client";

import { useInView } from "motion/react";
import { createContext, type ReactNode, useContext, useRef } from "react";

import { AgentTranscript } from "./agent-transcript";
import { LenscalPaywall, PAYWALL_HEIGHT, PAYWALL_WIDTH } from "./lenscal-paywall";
import { type TranscriptPlayback, useTranscriptPlayback } from "./use-transcript-playback";
import { WorkingIndicator } from "./working-indicator";

/**
 * How far down the paywall is displayed inside the designer mock. Matches the 242×525
 * slot the exported artboard occupied, so the surrounding chrome stays pixel-faithful.
 */
const PAYWALL_SCALE = 0.6015;

const PlaybackContext = createContext<TranscriptPlayback | null>(null);

/**
 * Hosts the shared Claude Code session driving both halves of the paywalls illustration:
 * the full-width terminal and the designer canvas the paywall assembles on.
 */
export function PaywallBuildProvider({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const started = useInView(ref, { amount: 0.35, once: true });
  // The session would otherwise loop (timers, typing interval, pixi ticker) for the rest of the
  // page's life once seen — pausing offscreen costs nothing visually because the loop replays
  // from the prompt anyway.
  const visible = useInView(ref);
  const playback = useTranscriptPlayback(started && visible);

  return (
    <div className={className} ref={ref}>
      <PlaybackContext.Provider value={playback}>{children}</PlaybackContext.Provider>
    </div>
  );
}

function usePlayback(): TranscriptPlayback {
  const playback = useContext(PlaybackContext);
  if (!playback) {
    throw new Error("PaywallBuild pieces must render inside PaywallBuildProvider");
  }
  return playback;
}

/**
 * The Claude Code terminal rendered at natural size above the designer mock. Only shown
 * below xl — scaling the terminal down with the rest of the mock made it unreadable, so
 * small screens get it full width while desktop keeps it floating on the canvas.
 */
export function PaywallBuildTerminal() {
  return (
    <div className="xl:hidden">
      <AgentTranscript playback={usePlayback()} />
    </div>
  );
}

/**
 * Overlay for the designer mock: the paywall assembling itself on the canvas as each MCP
 * call comes back. On xl the terminal floats over the canvas as in the original design and
 * the phone keeps its artboard position. Below xl the terminal lives above the mock, the
 * mock's side panels and tab bar are trimmed, and the phone (with its working-indicator
 * effect) is bumped up 25% and centered on the now-free canvas — `top-35` leaves an even
 * 48px of artboard padding under the toolbar and above the window's bottom edge.
 */
export function PaywallBuildCanvas() {
  const playback = usePlayback();

  return (
    <div className="absolute inset-0">
      <div className="absolute top-48.25 left-15.75 hidden h-129.25 w-99.75 xl:block">
        <AgentTranscript playback={playback} />
      </div>

      <div
        className="absolute top-35 left-1/2 origin-top -translate-x-1/2 scale-125 xl:top-37.75 xl:left-140.75 xl:translate-x-0 xl:scale-100"
        style={{ height: PAYWALL_HEIGHT * PAYWALL_SCALE, width: PAYWALL_WIDTH * PAYWALL_SCALE }}
      >
        <div
          className="origin-top-left"
          style={{ transform: `scale(${PAYWALL_SCALE})`, width: PAYWALL_WIDTH }}
        >
          <LenscalPaywall revealed={playback.revealed} />
        </div>
        <WorkingIndicator
          active={playback.working}
          height={PAYWALL_HEIGHT}
          scale={PAYWALL_SCALE}
          width={PAYWALL_WIDTH}
        />
      </div>
    </div>
  );
}
