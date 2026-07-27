"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

import { AGENT_PROMPT, type PaywallPart, TRANSCRIPT_STEPS } from "./transcript";

/** Milliseconds each character of the user prompt takes to type. */
export const PROMPT_CHAR_MS = 22;

/** Beat between the prompt landing and the first tool call going out. */
const INTRO_MS = 900;

/** Beat between one call's result and the next call going out. */
const SETTLE_GAP_MS = 240;

/** How long the finished paywall is held before the session replays. */
const LOOP_HOLD_MS = 5000;

type Phase = "idle" | "prompt" | "running" | "settled" | "done";

export interface TranscriptPlayback {
  /** Index of the call currently on screen; `-1` while the prompt is still typing. */
  readonly index: number;
  readonly phase: Phase;
  /** Paywall fragments whose insert has already come back. */
  readonly revealed: ReadonlySet<PaywallPart>;
  /** Whether the agent holds an open edit session — drives the canvas working indicator. */
  readonly working: boolean;
}

const ALL_PARTS: ReadonlySet<PaywallPart> = new Set(
  TRANSCRIPT_STEPS.flatMap((step) => step.reveals ?? []),
);

const FINISHED: TranscriptPlayback = {
  index: TRANSCRIPT_STEPS.length - 1,
  phase: "done",
  revealed: ALL_PARTS,
  working: false,
};

/**
 * Loops the scripted agent session once `active` turns true: the prompt types out, each
 * Voidhash MCP call goes out, hangs for its `runningMs`, and returns; the finished paywall
 * is held for a beat, then the whole session starts over. Turning `active` off rewinds to
 * the blank state, so a paused illustration schedules no timers and drives no animation.
 *
 * Under `prefers-reduced-motion` the session is presented already finished and never loops,
 * so the transcript and the paywall still read as a complete story without any movement.
 */
export function useTranscriptPlayback(active: boolean): TranscriptPlayback {
  const prefersReducedMotion = useReducedMotion();
  const [cursor, setCursor] = useState<{ index: number; phase: Phase }>({
    index: -1,
    phase: "idle",
  });

  useEffect(() => {
    if (!active) {
      setCursor((current) =>
        current.phase === "idle" ? current : { index: -1, phase: "idle" },
      );
      return;
    }

    if (prefersReducedMotion) {
      setCursor({ index: FINISHED.index, phase: "done" });
      return;
    }

    let timer: ReturnType<typeof setTimeout>;

    const runStep = (index: number) => {
      const step = TRANSCRIPT_STEPS[index];
      if (!step) {
        setCursor({ index: TRANSCRIPT_STEPS.length - 1, phase: "done" });
        timer = setTimeout(startSession, LOOP_HOLD_MS);
        return;
      }

      setCursor({ index, phase: "running" });
      timer = setTimeout(() => {
        setCursor({ index, phase: "settled" });
        timer = setTimeout(() => runStep(index + 1), SETTLE_GAP_MS);
      }, step.runningMs);
    };

    // Named so the last step can schedule the next run; the transcript and every
    // revealed fragment fall back to their empty state while the prompt retypes.
    function startSession() {
      setCursor({ index: -1, phase: "prompt" });
      timer = setTimeout(() => runStep(0), AGENT_PROMPT.length * PROMPT_CHAR_MS + INTRO_MS);
    }

    startSession();

    return () => clearTimeout(timer);
  }, [active, prefersReducedMotion]);

  return useMemo(() => {
    if (cursor.phase === "idle") {
      return { index: -1, phase: "idle", revealed: new Set<PaywallPart>(), working: false };
    }
    if (cursor.phase === "done") {
      return FINISHED;
    }

    // An insert only shows on the canvas once its call has come back.
    const landed = cursor.phase === "settled" ? cursor.index : cursor.index - 1;
    return {
      index: cursor.index,
      phase: cursor.phase,
      revealed: new Set(TRANSCRIPT_STEPS.slice(0, landed + 1).flatMap((step) => step.reveals ?? [])),
      working: cursor.phase !== "prompt",
    };
  }, [cursor]);
}
