import { ChevronLeft, Ellipsis } from "lucide-react";
import type { ComponentProps, CSSProperties, ReactNode } from "react";

import { cn } from "../lib/utils";

/**
 * Width-to-height ratio of the whole device: a 9:19.5 screen plus a bezel that
 * adds 2.5% of the device width on every side (0.95 * 19.5/9 + 0.05 = 2.108…).
 * Exported so height-constrained layouts can derive the device width.
 */
export const PHONE_ASPECT_RATIO = 9 / 18.975;

/** Frosted pill shared by the browser toolbar controls. */
const TOOLBAR_PILL =
  "flex items-center justify-center rounded-full bg-[rgba(15,15,15,0.32)] text-white/80 shadow-[0px_0px_1.5px_rgba(0,0,0,0.1),0px_0.65px_5px_rgba(0,0,0,0.12),inset_0.65px_0.65px_1px_-0.65px_rgba(255,255,255,0.8),inset_-0.65px_-0.65px_2px_-0.65px_rgba(255,255,255,0.4)] backdrop-blur-sm";

export interface PhoneProps extends Omit<ComponentProps<"div">, "children"> {
  /** Screen content. Clipped to the rounded display; use `size-full` to fill it. */
  children?: ReactNode;
  /**
   * Derive the device size from the available height instead of the available
   * width — pair with `h-full`/`max-h-*` on `className`.
   */
  fitHeight?: boolean;
  /** Extra classes for the screen surface (e.g. its background colour). */
  screenClassName?: string;
  /** When set, floats a Safari-style toolbar showing this URL over the screen. */
  url?: string;
}

/**
 * Chrome-less phone mockup: a black body with a rounded 9:19.5 screen, dynamic
 * island, home indicator and side buttons. Every dimension is expressed in
 * container-query units against the device's own width, so a single component
 * renders identically from a tiny dashboard thumbnail up to a full preview.
 */
export function Phone({
  children,
  className,
  fitHeight = false,
  screenClassName,
  style,
  url,
  ...props
}: PhoneProps) {
  const sizing: CSSProperties | undefined = fitHeight
    ? { aspectRatio: PHONE_ASPECT_RATIO, ...style }
    : style;

  return (
    <div
      className={cn(
        "@container relative flex flex-col justify-center",
        // In height-driven mode the body's own height comes out of the aspect
        // ratio, so `justify-center` only matters when a max-width squeezes the
        // device narrower than its slot — it keeps it centred instead of top-aligned.
        fitHeight ? "h-full w-auto" : "w-full",
        className,
      )}
      style={sizing}
      {...props}
    >
      <div className="relative w-full rounded-[15cqw] bg-black p-[2.5%] outline-2 outline-[#333]">
        {/* The screen radius is deliberately not concentric with the body — it
            matches the reference mockup's slightly rounder display corners. */}
        <div className="relative aspect-[9/19.5] overflow-hidden rounded-[calc(15cqw_-_6px)]">
          <div className={cn("absolute inset-0 bg-[#878787]", screenClassName)}>{children}</div>
          {url !== undefined && (
            <div className="pointer-events-none absolute bottom-0 left-0 h-[18%] w-full bg-linear-to-b from-transparent via-black/20 to-black/70" />
          )}
        </div>

        {/* Dynamic island */}
        <div className="-translate-x-1/2 pointer-events-none absolute top-[2.5%] left-1/2 h-[4%] w-[30%] rounded-full bg-black" />

        {/* Home indicator */}
        <div className="-translate-x-1/2 pointer-events-none absolute bottom-[3%] left-1/2 h-[0.6%] w-[34%] rounded-full bg-white" />

        {url !== undefined && (
          <div className="pointer-events-none absolute bottom-[6%] left-0 flex w-full items-center justify-between gap-2 px-[6%]">
            <div className={cn(TOOLBAR_PILL, "size-[12cqw]")}>
              <ChevronLeft className="-ml-[0.5cqw] size-[5cqw]" />
            </div>
            <div className={cn(TOOLBAR_PILL, "h-[12cqw] min-w-0 flex-1")}>
              <span className="block w-full truncate px-4 text-center text-[4.5cqw] text-white">
                {url}
              </span>
            </div>
            <div className={cn(TOOLBAR_PILL, "size-[12cqw]")}>
              <Ellipsis className="size-[5cqw]" />
            </div>
          </div>
        )}

        {/* Side buttons — offset by the 2px body outline so they butt against it */}
        <div className="-left-1 pointer-events-none absolute top-[15%] h-[3.5%] w-0.5 rounded-tl-full rounded-bl-full bg-[#333]" />
        <div className="-left-1 pointer-events-none absolute top-[23.4%] h-[7.1%] w-0.5 rounded-tl-full rounded-bl-full bg-[#333]" />
        <div className="-left-1 pointer-events-none absolute top-[32.4%] h-[7.1%] w-0.5 rounded-tl-full rounded-bl-full bg-[#333]" />
        <div className="-right-1 pointer-events-none absolute top-[28.2%] h-[11%] w-0.5 rounded-tr-full rounded-br-full bg-[#333]" />
      </div>
    </div>
  );
}
