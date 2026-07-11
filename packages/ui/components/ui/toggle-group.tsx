"use client";

import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import type { VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "../../lib/utils";
import { toggleVariants } from "./toggle";

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & {
    spacing?: number;
  }
>({
  size: "default",
  spacing: 0,
  variant: "default",
});

function ToggleGroup({
  className,
  indicatorClassName,
  variant,
  size,
  spacing = 0,
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> &
  VariantProps<typeof toggleVariants> & {
    spacing?: number;
    /**
     * Classes merged into the sliding active indicator — e.g. `bg-primary` to
     * recolor it or `duration-150` to retime its slide animation.
     */
    indicatorClassName?: string;
  }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = React.useState<{
    left: number;
    width: number;
  } | null>(null);

  const updateIndicator = React.useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const activeItem = container.querySelector<HTMLElement>('[data-state="on"]');
    if (!activeItem) {
      setIndicator(null);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();
    const borderWidth = parseFloat(getComputedStyle(container).borderLeftWidth) || 0;

    setIndicator({
      left: itemRect.left - containerRect.left - borderWidth,
      width: itemRect.width,
    });
  }, []);

  React.useEffect(() => {
    updateIndicator();

    const container = containerRef.current;
    if (!container) return;

    const observer = new MutationObserver(updateIndicator);
    observer.observe(container, {
      attributes: true,
      attributeFilter: ["data-state"],
      subtree: true,
    });

    return () => observer.disconnect();
  }, [updateIndicator]);

  return (
    <ToggleGroupPrimitive.Root
      ref={containerRef}
      className={cn(
        "group/toggle-group relative flex w-fit items-center gap-[--spacing(var(--gap))] rounded-lg",
        variant === "outline" && "border-input dark:bg-input/30 border bg-transparent shadow-xs",
        className,
      )}
      data-size={size}
      data-slot="toggle-group"
      data-spacing={spacing}
      data-variant={variant}
      style={{ "--gap": spacing } as React.CSSProperties}
      {...props}
    >
      {indicator && (
        <div
          className={cn(
            "bg-accent absolute top-0 rounded-[calc(var(--radius-lg)-1px)] transition-all duration-200 ease-out",
            indicatorClassName,
          )}
          style={{
            height: "100%",
            left: indicator.left,
            width: indicator.width,
          }}
        />
      )}
      <ToggleGroupContext.Provider value={{ size, spacing, variant }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
}

function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> & VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext);

  return (
    <ToggleGroupPrimitive.Item
      className={cn(
        toggleVariants({
          size: context.size || size,
          variant: context.variant || variant,
        }),
        "relative z-10 w-auto min-w-0 shrink-0 rounded-[calc(var(--radius-lg)-1px)] border-none bg-transparent px-3 shadow-none hover:bg-accent dark:hover:bg-input/50 focus:z-20 focus-visible:z-20 data-[state=on]:bg-transparent data-[state=on]:text-accent-foreground",
        className,
      )}
      data-size={context.size || size}
      data-slot="toggle-group-item"
      data-spacing={context.spacing}
      data-variant={context.variant || variant}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  );
}

export { ToggleGroup, ToggleGroupItem };
