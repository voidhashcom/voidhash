"use client";

import { cn } from "@voidhash/ui";
import { type ReactNode, useEffect, useRef, useState } from "react";

/** Full-bleed landing section: bottom hairline plus a centered, side-bordered content column. */
export function LandingSection({
  id,
  className,
  innerClassName,
  children,
}: {
  id?: string;
  className?: string;
  innerClassName?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 scroll-mt-24 flex-col items-center self-stretch border-zinc-800 border-b",
        className,
      )}
      id={id}
    >
      <div className={cn("w-full max-w-[1656px] border-zinc-800 xl:border-x", innerClassName)}>
        {children}
      </div>
    </section>
  );
}

/**
 * Eyebrow + headline + optional supporting copy header shared by the product sections.
 *
 * The eyebrow and headline are top-aligned so their gap stays identical in every section — the
 * description hangs off the same top edge instead of bottom-aligning to the headline, which used
 * to push the headline down by however many lines the description happened to wrap to.
 */
export function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-4 self-stretch">
      <div className="font-medium font-sans text-zinc-400 text-base leading-[120%] tracking-[-0.01em]">
        {eyebrow}
      </div>
      <div className="flex flex-col gap-6 self-stretch lg:flex-row lg:items-start lg:justify-between lg:gap-12">
        <h2 className="max-w-[627px] font-sans font-semibold text-[28px] text-white leading-[120%] tracking-[-0.03em] md:text-[36px]">
          {title}
        </h2>
        {description ? (
          <p className="max-w-[465px] font-sans text-[#FFFFFFB8] text-base/6.5 tracking-[-0.03em] md:text-xl/8">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Scales a fixed-width design fragment down to fit its container.
 *
 * The product mockups are pixel-faithful exports from the 1810px artboard, so instead of
 * re-flowing their internals we shrink each one with `transform: scale`. `zoom` would keep
 * layout height in sync for free, but iOS Safari shrinks only the boxes and re-renders the
 * text near its original size, leaving the copy overlapping — a transform scales the rendered
 * pixels wholesale, text included. The wrapper's height is synced to the scaled frame instead.
 *
 * @param designWidth Intrinsic width of the exported fragment, in artboard pixels.
 * @param compactDesignWidth Narrower intrinsic width used below `xl`, for mockups whose markup
 *   drops its outer columns there. Scaling to the trimmed width rather than the full artboard is
 *   what actually buys the phone-sized viewport its resolution back.
 */
export function ScaledMock({
  designWidth,
  compactDesignWidth,
  className,
  children,
}: {
  designWidth: number;
  compactDesignWidth?: number;
  className?: string;
  children: ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    if (compactDesignWidth === undefined) {
      return;
    }

    // Matches Tailwind's `xl` breakpoint, which is where the mockups drop their outer columns.
    const query = window.matchMedia("(width < 80rem)");
    const sync = () => setCompact(query.matches);

    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [compactDesignWidth]);

  const width = compact && compactDesignWidth !== undefined ? compactDesignWidth : designWidth;

  useEffect(() => {
    const frame = frameRef.current;
    const sizer = sizerRef.current;
    const viewport = viewportRef.current;
    if (!frame || !sizer || !viewport) {
      return;
    }

    const applyScale = () => {
      const scale = Math.min(1, viewport.clientWidth / width);
      frame.style.transform = `scale(${scale})`;
      sizer.style.height = `${frame.offsetHeight * scale}px`;
    };

    applyScale();

    // The frame is observed too: offsetHeight ignores the transform, so a content-height
    // change (fonts loading, animated blocks) must re-sync the sizer height.
    const observer = new ResizeObserver(applyScale);
    observer.observe(viewport);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div className={cn("w-full min-w-0", className)} ref={viewportRef}>
      {/* The scaled height lives on this inner div: callers pass flex classes for the outer
          wrapper, and a flex-basis would override an inline height set directly on it. */}
      <div ref={sizerRef}>
        {/* flow-root keeps child margins inside the frame's box, so they get measured and
            scaled with the rest of the mockup instead of collapsing out past the transform. */}
        <div className="flow-root origin-top-left" ref={frameRef} style={{ width }}>
          {children}
        </div>
      </div>
    </div>
  );
}
