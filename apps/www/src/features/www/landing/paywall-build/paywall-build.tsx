"use client";

import { useInView } from "motion/react";
import { useRef } from "react";

import { AgentTranscript } from "./agent-transcript";
import { LenscalPaywall, PAYWALL_HEIGHT, PAYWALL_WIDTH } from "./lenscal-paywall";
import { useTranscriptPlayback } from "./use-transcript-playback";
import { WorkingIndicator } from "./working-indicator";

/**
 * How far down the paywall is displayed inside the designer mock. Matches the 242×525
 * slot the exported artboard occupied, so the surrounding chrome stays pixel-faithful.
 */
const PAYWALL_SCALE = 0.6015;

/**
 * The designer illustration's live half: a Claude Code session driving the Voidhash MCP,
 * and the paywall assembling itself on the canvas as each call comes back.
 */
export function PaywallBuild() {
  const ref = useRef<HTMLDivElement>(null);
  const started = useInView(ref, { amount: 0.35, once: true });
  // The session would otherwise loop (timers, typing interval, pixi ticker) for the rest of the
  // page's life once seen — pausing offscreen costs nothing visually because the loop replays
  // from the prompt anyway.
  const visible = useInView(ref);
  const playback = useTranscriptPlayback(started && visible);

  return (
    <div className="absolute inset-0" ref={ref}>
      <div className="absolute top-48.25 left-15.75 h-129.25 w-99.75">
        <AgentTranscript playback={playback} />
      </div>

      <div
        className="absolute top-37.75 left-140.75"
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
