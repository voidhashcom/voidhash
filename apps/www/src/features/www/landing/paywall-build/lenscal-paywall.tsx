import { cn } from "@voidhash/ui";
import type { ReactNode } from "react";

import type { PaywallPart } from "./transcript";

export const PAYWALL_WIDTH = 402;
export const PAYWALL_HEIGHT = 874;

interface PartProps {
  children?: ReactNode;
  className?: string;
  /** Stagger within a group that lands on the same call, in milliseconds. */
  delay?: number;
  part: PaywallPart;
  revealed: ReadonlySet<PaywallPart>;
}

/** Settles a paywall fragment onto the canvas once the edit that inserts it comes back. */
function Part({ children, className, delay = 0, part, revealed }: PartProps) {
  const shown = revealed.has(part);

  return (
    <div
      className={cn(
        "transition-[opacity,filter,translate] duration-700 ease-out",
        shown ? "translate-y-0 opacity-100 blur-none" : "translate-y-1 opacity-0 blur-[6px]",
        className,
      )}
      style={{ transitionDelay: shown ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}

/** The concentric scan rings behind the app icon, widest to tightest. */
const SCAN_RINGS = [
  "left-32.25 top-32.75 size-36 [border-width:1.5px] border-[#6E9BFFB3]",
  "left-24.25 top-24.75 size-52 border border-[#5A8AFF73]",
  "left-14.75 top-15.25 h-71 w-71 border border-[#5A8AFF45]",
  "left-3.25 top-3.75 h-94 w-94 border border-[#5A8AFF30]",
  "-left-10.25 -top-9.75 h-121 w-121 border border-[#5A8AFF21]",
  "-left-25.75 -top-25.25 h-152 w-152 border border-[#5A8AFF17]",
  "-left-43.25 -top-42.75 h-187 w-187 border border-[#5A8AFF0F]",
  "-left-62.75 -top-62.25 h-226 w-226 border border-[#5A8AFF0A]",
];

/** The camera-detection chips floating over the hero. */
const DETECTION_CHIPS = [
  { className: "left-5.5 top-27.5", delay: 0, label: "Avocado toast · 412 kcal" },
  { className: "left-41.5 top-80.5", delay: 140, label: "Protein 32 g · Carbs 41 g" },
];

/** The laurel that brackets each award badge; `flipped` mirrors it for the right side. */
function Laurel({ flipped }: { flipped?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      height="44"
      style={{ flexShrink: 0, transform: flipped ? "scaleX(-1)" : undefined }}
      viewBox="0 0 14 44"
      width="14"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M11 4 C3 13, 2 27, 8 41" fill="none" stroke="#6B6B72" strokeWidth="1.3" />
      <circle cx="9.2" cy="8" fill="#6B6B72" r="2" />
      <circle cx="6" cy="12.5" fill="#6B6B72" r="2" />
      <circle cx="4" cy="18" fill="#6B6B72" r="2" />
      <circle cx="3.2" cy="24" fill="#6B6B72" r="2" />
      <circle cx="3.6" cy="30" fill="#6B6B72" r="2" />
      <circle cx="5" cy="35.5" fill="#6B6B72" r="2" />
    </svg>
  );
}

function AwardBadge({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-18 grow basis-[0%] items-center justify-center gap-1 rounded-[12px] border border-[#1B2133] border-solid bg-[#0A0D15] px-2">
      <Laurel />
      {children}
      <Laurel flipped />
    </div>
  );
}

function AppleMark() {
  return (
    <svg
      aria-hidden="true"
      height="18"
      style={{ flexShrink: 0 }}
      viewBox="0 0 15 18"
      width="15"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12.4 9.5c0-2 1.6-3 1.7-3.1-.9-1.4-2.4-1.5-2.9-1.6-1.2-.1-2.4.7-3 .7s-1.6-.7-2.6-.7c-1.3 0-2.6.8-3.2 2-1.4 2.4-.4 6 1 8 .7 1 1.5 2.1 2.5 2 1 0 1.4-.6 2.6-.6s1.5.6 2.6.6c1.1 0 1.8-1 2.4-2 .8-1.1 1.1-2.3 1.1-2.3s-2.2-.9-2.2-3zM10.4 3.3c.5-.7.9-1.6.8-2.5-.8 0-1.8.5-2.4 1.2-.5.6-1 1.6-.8 2.5.9.1 1.8-.4 2.4-1.2z"
        fill="#E4E4E7"
      />
    </svg>
  );
}

/**
 * The Lenscal Pro paywall the landing-page agent builds, rendered at its native
 * 402×874 so the fragments can settle in one by one as the MCP calls land.
 */
export function LenscalPaywall({ revealed }: { revealed: ReadonlySet<PaywallPart> }) {
  return (
    <div className="flex h-218.5 w-100.5 flex-col overflow-clip bg-black">
      <div className="relative h-106 w-100.5 shrink-0 overflow-clip">
        <Part className="absolute top-0 left-0 h-106 w-100.5" part="backdrop" revealed={revealed}>
          <div
            className="size-full"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 114.99999999999999% 80% at 50% 48% in oklab, oklab(29.5% -0.007 -0.103) 0%, oklab(20.6% -0.004 -0.061) 32%, oklab(11.7% -0.004 -0.027) 62%, oklab(0% 0 0) 82%)",
            }}
          />
        </Part>

        <div className="absolute top-0 left-0 h-106 w-100.5">
          {SCAN_RINGS.map((ring, index) => (
            <Part
              className={cn("absolute rounded-[999px] border-solid", ring)}
              delay={index * 70}
              key={ring}
              part="rings"
              revealed={revealed}
            />
          ))}
        </div>

        <Part
          className="absolute top-39.5 left-39 flex size-22.5 items-center justify-center rounded-[24px] border border-[#23325E] border-solid bg-[#0B1020] [box-shadow:#3A6EFF61_0px_0px_84px_24px,#000000B3_0px_18px_44px]"
          part="appIcon"
          revealed={revealed}
        >
          <svg
            aria-hidden="true"
            height="54"
            style={{ flexShrink: 0 }}
            viewBox="0 0 54 54"
            width="54"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="27" cy="27" fill="none" r="22" stroke="#22304F" strokeWidth="5" />
            <path
              d="M27 5 A22 22 0 1 1 6.33 34.52"
              fill="none"
              stroke="var(--color-brand-primary)"
              strokeLinecap="round"
              strokeWidth="5"
            />
            <circle cx="27" cy="27" fill="none" r="9" stroke="#F4F4F5" strokeWidth="4" />
          </svg>
        </Part>

        <Part className="absolute top-75 left-0 h-31 w-100.5" part="backdrop" revealed={revealed}>
          <div
            className="size-full"
            style={{
              backgroundImage:
                "linear-gradient(in oklab 180deg, oklab(0% 0 0 / 0%) 0%, oklab(0% 0 0 / 55%) 46%, oklab(0% 0 0 / 92%) 78%, oklab(0% 0 0) 100%)",
            }}
          />
        </Part>

        <Part
          className="absolute top-0 left-0 flex w-100.5 items-center gap-38.5 px-6 pt-5.25 pb-4.75"
          part="statusBar"
          revealed={revealed}
        >
          <div className="flex grow basis-[0%] flex-col items-center justify-center">
            <div className="flex w-fit flex-wrap justify-center text-center font-sans font-semibold text-[17px]/5.5 text-white">
              9:41
            </div>
          </div>
          <div className="flex grow basis-[0%] flex-col items-center justify-center">
            <svg
              aria-hidden="true"
              height="22"
              style={{ flexShrink: 0 }}
              viewBox="0 0 82 22"
              width="82"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3.7 13H2.5a1 1 0 0 0-1 1v2.5a1 1 0 0 0 1 1h1.2a1 1 0 0 0 1-1V14a1 1 0 0 0-1-1m5.2-2.5H7.7a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h1.2a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1M14.1 8h-1.2a1 1 0 0 0-1 1v7.5a1 1 0 0 0 1 1h1.2a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1m5.2-2.5h-1.2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h1.2a1 1 0 0 0 1-1v-10a1 1 0 0 0-1-1"
                fill="#FFFFFF"
              />
              <path
                clipRule="evenodd"
                d="M36.57 7.8c2.49 0 4.88.92 6.68 2.58.14.13.36.12.49 0l1.3-1.27a.34.34 0 0 0 0-.5 12.55 12.55 0 0 0-16.93 0 .34.34 0 0 0 0 .5l1.3 1.26c.13.13.34.14.48 0a10 10 0 0 1 6.68-2.57m0 4.22a5.4 5.4 0 0 1 3.67 1.44c.14.13.35.13.48 0l1.3-1.33a.37.37 0 0 0-.01-.52 7.9 7.9 0 0 0-10.88 0 .37.37 0 0 0 0 .52l1.29 1.32c.13.14.34.14.48 0 1-.92 2.31-1.43 3.67-1.43m2.52 2.8q0 .15-.1.28l-2.18 2.45a.3.3 0 0 1-.24.11.3.3 0 0 1-.24-.1l-2.18-2.46a.43.43 0 0 1 .01-.56 3.44 3.44 0 0 1 4.82 0 .4.4 0 0 1 .11.28"
                fill="#FFFFFF"
                fillRule="evenodd"
              />
              <path
                clipRule="evenodd"
                d="M70.5 5c2.05 0 3.08 0 3.88.34a4.3 4.3 0 0 1 2.28 2.28c.34.8.34 1.83.34 3.88s0 3.08-.34 3.88a4.3 4.3 0 0 1-2.28 2.28c-.8.34-1.83.34-3.88.34h-12c-2.05 0-3.08 0-3.88-.34a4.3 4.3 0 0 1-2.28-2.28c-.34-.8-.34-1.83-.34-3.88s0-3.08.34-3.88a4.3 4.3 0 0 1 2.28-2.28C55.42 5 56.45 5 58.5 5zM58.28 6c-1.85 0-2.77 0-3.48.36a3.3 3.3 0 0 0-1.44 1.44C53 8.5 53 9.43 53 11.28v.44c0 1.85 0 2.77.36 3.48a3.3 3.3 0 0 0 1.44 1.44c.7.36 1.63.36 3.48.36h12.44c1.85 0 2.77 0 3.48-.36a3.3 3.3 0 0 0 1.44-1.44c.36-.7.36-1.63.36-3.48v-.44c0-1.85 0-2.77-.36-3.48a3.3 3.3 0 0 0-1.44-1.44C73.5 6 72.57 6 70.72 6z"
                fill="#FFFFFF"
                fillRule="evenodd"
                style={{ opacity: "0.35" }}
              />
              <path
                d="M54 11c0-1.4 0-2.1.27-2.63a2.5 2.5 0 0 1 1.1-1.1C55.9 7 56.6 7 58 7h13c1.4 0 2.1 0 2.64.27q.72.37 1.09 1.1C75 8.9 75 9.6 75 11v1c0 1.4 0 2.1-.27 2.64a2.5 2.5 0 0 1-1.1 1.09C73.1 16 72.4 16 71 16H58c-1.4 0-2.1 0-2.63-.27a2.5 2.5 0 0 1-1.1-1.1C54 14.1 54 13.4 54 12z"
                fill="#FFFFFF"
              />
              <path
                d="M78 9.5v4.08a2.2 2.2 0 0 0 1.33-2.04A2.2 2.2 0 0 0 78 9.5"
                fill="#FFFFFF"
                style={{ opacity: "0.35" }}
              />
            </svg>
          </div>
        </Part>

        {DETECTION_CHIPS.map((chip) => (
          <Part
            className={cn(
              "absolute flex items-center gap-2 rounded-[999px] border border-[#5A8AFF3D] border-solid bg-[#090F21C7] py-1.75 pr-3.25 pl-2.75",
              chip.className,
            )}
            delay={chip.delay}
            key={chip.label}
            part="chips"
            revealed={revealed}
          >
            <div className="size-1.5 shrink-0 rounded-[999px] [background-color:var(--color-brand-primary)]" />
            <div className="font-medium font-sans text-[#D3DCF0] text-xs/4 tracking-[-0.005em]">
              {chip.label}
            </div>
          </Part>
        ))}
      </div>

      {/* Vertical rhythm is tuned so the whole column clears the 450px left under the hero —
          the artboard's own spacing overflowed and clipped the pricing terms. */}
      <div className="flex w-100.5 grow basis-[0%] flex-col bg-black px-5 pt-2 pb-4">
        <Part className="flex gap-2.5" part="badges" revealed={revealed}>
          <AwardBadge>
            <div className="flex grow basis-[0%] flex-col items-center gap-1.25">
              <AppleMark />
              <div className="flex flex-wrap justify-center whitespace-pre-wrap text-center font-sans font-semibold text-[#E4E4E7] text-xs/4 tracking-[-0.01em]">
                Editors'
                <br />
                Choice
              </div>
            </div>
          </AwardBadge>
          <AwardBadge>
            <div className="flex grow basis-[0%] flex-col items-center gap-1.25">
              <AppleMark />
              <div className="flex flex-wrap justify-center whitespace-pre-wrap text-center font-sans font-semibold text-[#E4E4E7] text-xs/4 tracking-[-0.01em]">
                App of
                <br />
                the Day
              </div>
            </div>
          </AwardBadge>
          <AwardBadge>
            <div className="flex grow basis-[0%] flex-col items-center gap-0.5">
              <div className="font-medium font-sans text-[#8F8F96] text-[10px]/3">80k Ratings</div>
              <div className="font-sans font-semibold text-[#F4F4F5] text-xl/normal tracking-[-0.02em]">
                4.9
              </div>
              <svg
                aria-hidden="true"
                height="11"
                style={{ flexShrink: 0 }}
                viewBox="0 0 62 11"
                width="62"
                xmlns="http://www.w3.org/2000/svg"
              >
                {[0, 13, 26, 39, 52].map((offset) => (
                  <path
                    d={`M${5.5 + offset} 0.5 L${6.9 + offset} 3.9 L${10.5 + offset} 4.2 L${7.8 + offset} 6.6 L${8.6 + offset} 10.2 L${5.5 + offset} 8.3 L${2.4 + offset} 10.2 L${3.2 + offset} 6.6 L${0.5 + offset} 4.2 L${4.1 + offset} 3.9 Z`}
                    fill="#6F9DFF"
                    key={offset}
                  />
                ))}
              </svg>
            </div>
          </AwardBadge>
        </Part>

        <Part className="flex flex-col items-center pt-6" part="title" revealed={revealed}>
          <div className="flex flex-wrap justify-center whitespace-pre-wrap text-center font-bold font-sans text-[#FAFAFA] text-[27px]/8.5 [letter-spacing:-0.025em]">
            Lenscal Pro
            <br />
            7-Day Free Trial
          </div>
        </Part>

        <Part
          className="flex flex-col items-center gap-0.75 pt-3"
          delay={120}
          part="offer"
          revealed={revealed}
        >
          <div className="font-sans text-[#A1A1AA] text-[15px]/5.5">
            Subscribe to Pro for just $29.99/year for a
          </div>
          <div className="flex items-baseline">
            <div className="font-sans text-[#A1A1AA] text-[15px]/5.5">limited time</div>
            <div className="font-sans text-[#71717A] text-[15px]/5.5 [text-decoration:line-through_1px] [text-underline-position:from-font]">
              ($49.99/year)
            </div>
            <div className="font-sans text-[#A1A1AA] text-[15px]/5.5">and unlock</div>
          </div>
          <div className="flex items-baseline gap-1.25">
            <div className="font-sans text-[#A1A1AA] text-[15px]/5.5">unlimited scans.</div>
            <div className="font-medium font-sans text-[#6F9DFF] text-[15px]/5.5">View More &gt;</div>
          </div>
        </Part>

        <Part className="flex items-center gap-3.5 pt-5" part="toggle" revealed={revealed}>
          <div className="flex h-7.75 w-12.75 shrink-0 items-center rounded-[999px] border border-[#2C3450] border-solid bg-[#0F121C] p-0.5">
            <div className="size-6.25 shrink-0 rounded-[999px] bg-[#FAFAFA] [box-shadow:#00000080_0px_1px_3px]" />
          </div>
          <div className="font-sans text-[#E4E4E7] text-[15px]/5">
            Remind me before free trial ends
          </div>
        </Part>

        <Part className="flex pt-4" delay={120} part="cta" revealed={revealed}>
          <div className="flex h-14 grow basis-[0%] items-center justify-center rounded-[999px] [background-color:var(--color-brand-primary)]">
            <div className="font-sans font-semibold text-[17px]/5.5 [color:var(--color-primary-foreground)] tracking-[-0.01em]">
              Try It Free
            </div>
          </div>
        </Part>

        <Part className="flex items-start gap-1.75 pt-3.5" part="finePrint" revealed={revealed}>
          <div className="size-3.25 shrink-0 rounded-[999px] border border-[#4B5570] border-solid" />
          <div className="flex grow basis-[0%] flex-col gap-0.5">
            <div className="flex flex-wrap items-baseline">
              <div className="font-sans text-[#8B8B93] text-[11px]/3.75">
                I have read and accept
              </div>
              <div className="font-sans text-[#C4C4CB] text-[11px]/3.75 [text-decoration:underline_1px] [text-underline-position:from-font]">
                Pricing Terms.
              </div>
              <div className="font-sans text-[#8B8B93] text-[11px]/3.75">
                Auto renew plans, cancel
              </div>
            </div>
            <div className="font-sans text-[#8B8B93] text-[11px]/3.75">
              anytime. Auto renew at $29.99 / Y after the trial, cancel anytime.
            </div>
          </div>
        </Part>
      </div>
    </div>
  );
}
