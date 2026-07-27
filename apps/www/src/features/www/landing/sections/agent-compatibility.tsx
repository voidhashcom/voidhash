import { TooltipContent, TooltipProvider, TooltipRoot, TooltipTrigger } from "@voidhash/ui";

import antigravityIcon from "../assets/agent-icons/antigravity.png";
import claudeCodeIcon from "../assets/agent-icons/claude-code.png";
import codexIcon from "../assets/agent-icons/codex.png";
import cursorIcon from "../assets/agent-icons/cursor.png";
import openCodeIcon from "../assets/agent-icons/opencode.png";

const agents = [
  { name: "Claude Code", src: claudeCodeIcon },
  { name: "Codex", src: codexIcon },
  { name: "Cursor", src: cursorIcon },
  { name: "Antigravity", src: antigravityIcon },
  { name: "OpenCode", src: openCodeIcon },
] as const;

/** Renders the AI agent compatibility band below the paywall designer. */
export function LandingAgentCompatibility() {
  return (
    <div className="flex min-h-20 items-center gap-3 border-zinc-800 border-t px-6 py-3 md:h-35.25 md:gap-4 md:px-12 md:py-0 xl:px-32">
      <TooltipProvider>
        <ul aria-label="Supported AI agent examples" className="flex shrink-0 items-start">
          {agents.map((agent, index) => (
            <li
              className={index === 0 ? undefined : "-ml-[17px] md:-ml-[27px]"}
              key={agent.name}
            >
              <TooltipRoot>
                <TooltipTrigger asChild>
                  <span className="block size-10 shrink-0 -rotate-[10deg] md:size-16" tabIndex={0}>
                    <img
                      alt={agent.name}
                      className="size-full max-w-none object-contain"
                      height={64}
                      src={agent.src}
                      width={64}
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  className="border-zinc-800 bg-zinc-900 text-zinc-50"
                  side="top"
                  sideOffset={8}
                >
                  {agent.name}
                </TooltipContent>
              </TooltipRoot>
            </li>
          ))}
        </ul>
      </TooltipProvider>
      <p className="min-w-0 max-w-[421px] flex-1 font-sans text-xs/4 text-zinc-400 md:w-[421px] md:flex-none md:text-base/5">
        Works with any AI agent or model. You can even use your Claude Code or Codex subscription.
      </p>
    </div>
  );
}
