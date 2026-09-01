"use client";

import * as React from "react";
import * as Option from "effect/Option";

import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "../../lib/utils";

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      className={cn("flex flex-col gap-2", className)}
      data-slot="tabs"
      {...props}
    />
  );
}

/**
 * Tab list rendering a sliding indicator that animates between triggers.
 *
 * @param indicatorClassName - Classes merged into the sliding active indicator
 * — e.g. `bg-primary` to recolor it or `duration-150` to retime its slide.
 */
function TabsList({
  className,
  indicatorClassName,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & {
  indicatorClassName?: string;
}) {
  const listRef = React.useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = React.useState<Option.Option<{
    height: number;
    left: number;
    top: number;
    width: number;
  }>>(Option.none());

  const updateIndicator = React.useCallback(() => {
    const list = listRef.current;
    if (!list) return;

    const activeTrigger = list.querySelector<HTMLElement>('[data-state="active"]');
    if (!activeTrigger) {
      setIndicator(Option.none());
      return;
    }

    const listRect = list.getBoundingClientRect();
    const triggerRect = activeTrigger.getBoundingClientRect();
    const listStyle = getComputedStyle(list);

    setIndicator(Option.some({
      height: triggerRect.height,
      left: triggerRect.left - listRect.left - (parseFloat(listStyle.borderLeftWidth) || 0),
      top: triggerRect.top - listRect.top - (parseFloat(listStyle.borderTopWidth) || 0),
      width: triggerRect.width,
    }));
  }, []);

  React.useEffect(() => {
    updateIndicator();

    const list = listRef.current;
    if (!list) return;

    const mutationObserver = new MutationObserver(updateIndicator);
    mutationObserver.observe(list, {
      attributeFilter: ["data-state"],
      attributes: true,
      childList: true,
      subtree: true,
    });

    const resizeObserver = new ResizeObserver(updateIndicator);
    resizeObserver.observe(list);

    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
    };
  }, [updateIndicator]);

  return (
    <TabsPrimitive.List
      className={cn(
        "relative inline-flex h-9 w-fit items-center justify-center rounded-lg bg-surface-muted p-[3px] text-muted-foreground",
        className,
      )}
      data-slot="tabs-list"
      ref={listRef}
      {...props}
    >
      {Option.isSome(indicator) && (
        <div
          className={cn(
            "pointer-events-none absolute rounded-md bg-surface shadow-sm transition-all duration-200 ease-out dark:border dark:border-border",
            indicatorClassName,
          )}
          style={{
            height: indicator.value.height,
            left: indicator.value.left,
            top: indicator.value.top,
            width: indicator.value.width,
          }}
        />
      )}
      {children}
    </TabsPrimitive.List>
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative z-10 inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-2 py-1 font-medium text-foreground text-sm transition-[color,box-shadow] focus-visible:border-ring focus-visible:outline-1 focus-visible:outline-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:text-muted-foreground dark:data-[state=active]:text-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      data-slot="tabs-trigger"
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("flex-1 outline-none", className)}
      data-slot="tabs-content"
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
