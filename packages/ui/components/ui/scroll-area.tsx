"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ScrollArea as ScrollAreaPrimitive } from "radix-ui";

import { cn } from "../../lib/utils";

function ScrollArea({
  className,
  children,
  fadeHint,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  fadeHint?: boolean;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState({
    top: false,
    bottom: false,
    left: false,
    right: false,
  });

  const checkScroll = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const threshold = 10;
    setCanScroll({
      top: el.scrollTop > threshold,
      bottom: el.scrollTop + el.clientHeight < el.scrollHeight - threshold,
      left: el.scrollLeft > threshold,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - threshold,
    });
  }, []);

  useEffect(() => {
    if (!fadeHint) return;
    const el = viewportRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll);
    const observer = new ResizeObserver(checkScroll);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      observer.disconnect();
    };
  }, [fadeHint, checkScroll]);

  return (
    <ScrollAreaPrimitive.Root
      className={cn("relative", className)}
      data-slot="scroll-area"
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        className="size-full rounded-[inherit] outline-ring/50 ring-ring/10 transition-[color,box-shadow] focus-visible:outline-1 focus-visible:ring-4 dark:outline-ring/40 dark:ring-ring/20"
        data-slot="scroll-area-viewport"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
      {fadeHint && (
        <>
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 top-0 h-12 bg-linear-to-b from-background to-transparent transition-opacity",
              canScroll.top ? "opacity-100" : "opacity-0",
            )}
          />
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-background to-transparent transition-opacity",
              canScroll.bottom ? "opacity-100" : "opacity-0",
            )}
          />
          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 left-0 w-12 bg-linear-to-r from-background to-transparent transition-opacity",
              canScroll.left ? "opacity-100" : "opacity-0",
            )}
          />
          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 right-0 w-12 bg-linear-to-l from-background to-transparent transition-opacity",
              canScroll.right ? "opacity-100" : "opacity-0",
            )}
          />
        </>
      )}
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      className={cn(
        "flex touch-none select-none p-px transition-colors",
        orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent",
        orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent",
        className,
      )}
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        className="relative flex-1 rounded-full bg-border"
        data-slot="scroll-area-thumb"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}

export { ScrollArea, ScrollBar };
