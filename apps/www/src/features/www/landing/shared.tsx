"use client";

import { cn } from "@voidhash/ui";
import { type ReactNode, useEffect, useRef } from "react";

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
 * re-flowing their internals we shrink each one with `zoom` — unlike `transform: scale`
 * it keeps the layout height in sync with the scaled content.
 */
export function ScaledMock({
  designWidth,
  className,
  children,
}: {
  designWidth: number;
  className?: string;
  children: ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    const viewport = frame?.parentElement;
    if (!frame || !viewport) {
      return;
    }

    const applyZoom = () => {
      frame.style.zoom = `${Math.min(1, viewport.clientWidth / designWidth)}`;
    };

    applyZoom();

    const observer = new ResizeObserver(applyZoom);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [designWidth]);

  return (
    <div className={cn("w-full min-w-0", className)}>
      <div ref={frameRef} style={{ width: designWidth }}>
        {children}
      </div>
    </div>
  );
}
