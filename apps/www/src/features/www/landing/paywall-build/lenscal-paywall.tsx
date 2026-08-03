import { cn } from "@voidhash/ui";
import type { ReactNode } from "react";

import boiledEggImage from "../assets/lenscal/boiled-egg.webp";
import calorieTrackerImage from "../assets/lenscal/calorie-tracker.webp";
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

const OFFER_LINE = "font-sans text-[#FFFFFFB0] text-[15px]/5.5";

const FINE_PRINT_LINE = "text-center font-sans text-[#FFFFFFB3] text-[11px]/3.75";

/**
 * The Lenscal Pro paywall the landing-page agent builds, rendered at its native
 * 402×874 so the fragments can settle in one by one as the MCP calls land.
 */
export function LenscalPaywall({ revealed }: { revealed: ReadonlySet<PaywallPart> }) {
  return (
    <div className="relative flex h-218.5 w-100.5 flex-col overflow-clip bg-black">
      <Part className="absolute inset-0" part="backdrop" revealed={revealed}>
        <div className="size-full bg-[#0088FF]" />
        <div
          className="absolute top-0 left-0 h-106.25 w-100.5"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 137.15% 95.41% at 52.16% 0% in oklab, oklab(48.2% 0.115 -0.237) 53.27%, oklab(0% 0 0 / 0%) 100%)",
          }}
        />
        <div
          className="absolute top-75 left-0 h-31 w-100.5"
          style={{
            backgroundImage:
              "linear-gradient(in oklab 180deg, oklab(0% 0 0 / 0%) 0%, oklab(63.2% -0.055 -0.194 / 28%) 46%, oklab(63.2% -0.055 -0.194) 77.72%, oklab(63.2% -0.055 -0.194) 100%)",
          }}
        />
      </Part>

      <div className="relative h-106.25 w-100.5 shrink-0 overflow-clip">
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

        {/* Sits directly on the hero (not inside the phone Part) because mix-blend-overlay
            must blend with the backdrop, and the Part's translate isolates its children. */}
        <Part
          className="absolute top-0 left-10.5 h-106.25 w-79.25 rounded-b-[64px] bg-[#0000003D] mix-blend-overlay"
          part="screenshot"
          revealed={revealed}
        />
        <Part className="absolute inset-0" part="screenshot" revealed={revealed}>
          <div className="absolute -top-1.25 left-13.5 h-104.25 w-73.25 rounded-b-[54px] bg-[#DDDDDD]" />
          <div
            className="absolute -top-55 left-13.5 h-158 w-73.25 rounded-b-[54px] bg-center bg-cover"
            style={{ backgroundImage: `url(${calorieTrackerImage})` }}
          />
        </Part>

        <Part className="absolute inset-0" part="foodCard" revealed={revealed}>
          <div
            className="absolute top-1/2 left-1/2 h-[72.181px] w-[317.491px] origin-top-left rounded-[22px] bg-[#1A70FD] [box-shadow:#00000033_0px_2px_13px]"
            style={{ rotate: "-0.41deg", translate: "calc(-50% - 1.258px) calc(-50% + 72.586px)" }}
          >
            <div
              className="absolute top-1/2 left-1/2 h-[82.899px] w-87 origin-top-left rounded-[22px] [box-shadow:#FFFFFF_0px_2px_2px_inset,#00000033_0px_2px_7px]"
              style={{
                backgroundImage:
                  "linear-gradient(in oklab 180deg, oklab(97.8% 0.011 -0.011) 0%, oklab(93.3% 0.009 -0.032) 100%)",
                rotate: "1.25deg",
                translate: "calc(-50% + 1.465px) calc(-50% - 23.74px)",
              }}
            >
              <div
                className="absolute top-3 left-4 h-14.75 w-15.5 rounded-[11px] bg-center bg-cover"
                style={{ backgroundImage: `url(${boiledEggImage})` }}
              />
              <div className="absolute top-3.75 left-22.75 font-sans font-semibold text-base/8.5 text-black tracking-[-0.025em]">
                Boiled Egg
              </div>
              <div className="absolute top-9.25 left-22.75 font-sans font-semibold text-[#9E9E9E] text-base/8.5 tracking-[-0.025em]">
                2 large
              </div>
              <div className="absolute top-3.75 left-75 font-sans font-semibold text-base/8.5 text-black tracking-[-0.025em]">
                180
              </div>
            </div>
          </div>
        </Part>
      </div>

      <div className="relative flex w-100.5 grow basis-[0%] flex-col items-center justify-center px-5 pt-2 pb-6">
        <Part className="flex flex-col items-center self-stretch pt-7.5" part="title" revealed={revealed}>
          <div className="flex flex-wrap justify-center whitespace-pre-wrap text-center font-bold font-sans text-3xl/8.5 text-[#FAFAFA] tracking-[-0.025em]">
            Lenscal Pro
            <br />
            7-Day Free Trial
          </div>
        </Part>

        <Part
          className="flex flex-col items-center gap-0.75 self-stretch pt-3"
          delay={120}
          part="offer"
          revealed={revealed}
        >
          <div className={OFFER_LINE}>Subscribe to Pro for just $29.99/year for a</div>
          <div className="flex items-baseline gap-1">
            <div className={OFFER_LINE}>limited time</div>
            <div className="font-sans text-[15px]/5.5 text-white [text-decoration:line-through_1px] [text-underline-position:from-font]">
              ($49.99/year)
            </div>
            <div className={OFFER_LINE}>and unlock</div>
          </div>
          <div className={OFFER_LINE}>unlimited scans.</div>
        </Part>

        <Part
          className="flex items-center justify-center gap-3.5 self-stretch pt-6.5"
          part="toggle"
          revealed={revealed}
        >
          <div className="flex h-7.75 w-12.75 shrink-0 items-center rounded-[999px] bg-[#86BEFF] p-0.5">
            <div className="size-6.25 shrink-0 rounded-[999px] bg-[#FAFAFA]" />
          </div>
          <div className="font-sans text-[#E4E4E7] text-[15px]/5">
            Remind me before free trial ends
          </div>
        </Part>

        <Part className="flex self-stretch pt-5" delay={120} part="cta" revealed={revealed}>
          <div
            className="flex h-14 grow basis-[0%] items-center justify-center rounded-[999px] [box-shadow:#FFFFFF_0px_2px_3px_inset,#00000033_0px_2px_7px]"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 94.235% 609.11% at 50% 50% in oklab, oklab(97.9% -0.002 -0.010) 0%, oklab(91.4% -0.008 -0.041) 100%)",
            }}
          >
            <div className="font-sans font-semibold text-[17px]/5.5 text-black tracking-[-0.01em]">
              Try It Free
            </div>
          </div>
        </Part>

        <Part className="flex flex-col gap-0.5 self-stretch pt-4" part="finePrint" revealed={revealed}>
          <div className="flex flex-wrap items-baseline justify-center gap-x-0.75">
            <div className={FINE_PRINT_LINE}>I have read and accept</div>
            <div className="font-sans text-[#C4C4CB] text-[11px]/3.75 [text-decoration:underline_1px] [text-underline-position:from-font]">
              Pricing Terms.
            </div>
            <div className={FINE_PRINT_LINE}>Auto renew plans, cancel</div>
          </div>
          <div className={FINE_PRINT_LINE}>
            anytime. Auto renew at $29.99 / Y after the trial, cancel anytime.
          </div>
        </Part>
      </div>
    </div>
  );
}
