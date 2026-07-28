"use client";

import { cn } from "@voidhash/ui";
import { useEffect, useRef, useState } from "react";

import { AGENT_INTRO, AGENT_OUTRO, AGENT_PROMPT, TRANSCRIPT_STEPS } from "./transcript";
import { PROMPT_CHAR_MS, type TranscriptPlayback } from "./use-transcript-playback";

const TERMINAL_BACKGROUND =
  "radial-gradient(ellipse 156.12% 100% at 100% -0.86% in oklab, var(--color-zinc-900) 0%, var(--color-zinc-950) 100%)";

/** Types a string out one character at a time; renders it whole when `typing` is false. */
function TypedText({ typing, text }: { typing: boolean; text: string }) {
  const [count, setCount] = useState(typing ? 0 : text.length);

  useEffect(() => {
    if (!typing) {
      setCount(text.length);
      return;
    }

    setCount(0);
    let typed = 0;
    const interval = setInterval(() => {
      typed += 1;
      setCount(typed);
      if (typed >= text.length) {
        clearInterval(interval);
      }
    }, PROMPT_CHAR_MS);

    return () => clearInterval(interval);
  }, [typing, text]);

  return <>{text.slice(0, count)}</>;
}

/** Renders a `key: value` argument line with the value picked out; free-form lines stay dim. */
function ArgumentLine({ argument }: { argument: string }) {
  const [, key, value] = /^([A-Za-z]+):\s(.*)$/.exec(argument) ?? [];

  return (
    <div className="pl-4 text-zinc-500">
      {key ? (
        <>
          {key}: <span className="text-blue-ribbon-300">{value}</span>
        </>
      ) : (
        argument
      )}
    </div>
  );
}

/** One `⏺ voidhash – tool (MCP)` block with its arguments and result line. */
function ToolCallBlock({
  index,
  playback,
}: {
  index: number;
  playback: TranscriptPlayback;
}) {
  const step = TRANSCRIPT_STEPS[index];
  const settled = index < playback.index || playback.phase !== "running";

  return (
    <div className="pt-3">
      <div className="text-zinc-400">
        {/* The marker goes green the moment the call comes back, as it does in Claude Code. */}
        <span className={settled ? "text-pistachio-600" : "text-blue-ribbon-500"}>⏺</span> voidhash –{" "}
        <span className="font-medium text-zinc-100">{step.tool}</span>{" "}
        <span className="text-zinc-600">(MCP)</span>
      </div>
      {step.args.map((argument) => (
        <ArgumentLine argument={argument} key={argument} />
      ))}
      <div className="text-zinc-400">
        <span className="pl-1.5 text-zinc-700">⎿</span>
        {"  "}
        {settled ? (
          step.result
        ) : (
          <span className="shimmer shimmer-duration-1600 text-zinc-500">Running…</span>
        )}
      </div>
    </div>
  );
}

/**
 * The Claude Code pane of the illustration: one user prompt followed by the Voidhash
 * MCP calls that compose the paywall. Scrolls itself so the newest call stays in view.
 * Fills its container's width; only the height is fixed.
 */
export function AgentTranscript({ playback }: { playback: TranscriptPlayback }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const started = playback.phase !== "idle";

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller) {
      scroller.scrollTo({ behavior: "smooth", top: scroller.scrollHeight });
    }
  }, [playback.index, playback.phase]);

  return (
    <div
      className="relative h-129.25 w-full rounded-[16px] border border-zinc-800 border-solid bg-origin-border bg-zinc-950 [box-shadow:#00000040_0px_2px_16px]"
      style={{ backgroundImage: TERMINAL_BACKGROUND }}
    >
      <div className="absolute top-3 left-3.25 size-3.25 rounded-full bg-zinc-700" />
      <div className="absolute top-3 left-8.5 size-3.25 rounded-full bg-zinc-700" />
      <div className="absolute top-3 left-13.75 size-3.25 rounded-full bg-zinc-700" />
      <div className="absolute inset-x-0 top-2.5 text-center font-sans text-xs text-zinc-600 leading-[142.857%]">
        Claude Code
      </div>

      <div
        className="absolute inset-x-6 top-9.75 h-114.5 overflow-hidden font-mono text-xs text-zinc-400 leading-[142.857%]"
        onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 4)}
        ref={scrollerRef}
      >
        {started ? (
          <>
            <div className="text-zinc-100">
              <span className="text-blue-ribbon-500">&gt;</span>{" "}
              <TypedText text={AGENT_PROMPT} typing={playback.phase === "prompt"} />
            </div>
            {playback.phase === "prompt" ? null : (
              <div className="pt-3 text-zinc-400">
                <span className="text-pistachio-600">⏺</span> {AGENT_INTRO}
              </div>
            )}
            {TRANSCRIPT_STEPS.slice(0, playback.index + 1).map((step, index) => (
              <ToolCallBlock index={index} key={step.tool + String(index)} playback={playback} />
            ))}
            {playback.phase === "done" ? (
              <div className="pt-3 text-zinc-300">
                <span className="text-pistachio-600">⏺</span> {AGENT_OUTRO}
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {/* Fades transcript lines out as they scroll past the top of the pane. Held back until
          the pane actually scrolls so it never sits over the prompt as it types. Spans the whole
          window (`-inset-px` covers the border box) so it repaints the window's own gradient in
          the same coordinate space; the mask keeps only the fading band at the pane's top edge. */}
      <div
        className={cn(
          "pointer-events-none absolute -inset-px rounded-[16px] transition-opacity duration-500",
          scrolled ? "opacity-100" : "opacity-0",
        )}
        style={{
          backgroundImage: TERMINAL_BACKGROUND,
          maskImage: "linear-gradient(to bottom, transparent 39px, black 39px, transparent 63px)",
        }}
      />
    </div>
  );
}
