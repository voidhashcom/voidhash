"use client";

import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "../lib/utils";

export type PageBarProps = {
  children?: React.ReactNode;
  rightActions?: React.ReactNode;
  className?: string;
};

/**
 * Full-width secondary bar rendered below a `PageHeader`. Shares the header's
 * horizontal spacing and bottom border, with a left side (`children`) and a
 * right side (`rightActions`) that can both hold tabs and buttons.
 */
export function PageBar({ children, rightActions, className }: PageBarProps) {
  return (
    <div
      className={cn(
        "flex min-h-11 items-center justify-between gap-4 border-border/60 bg-background px-4",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-4 self-stretch">{children}</div>
      {rightActions && <div className="flex items-center gap-2 self-stretch">{rightActions}</div>}
    </div>
  );
}

/**
 * Unstyled tabs root connecting `PageBarTabs` triggers to content rendered
 * anywhere below the bar. Wrap it around the `PageBar` and the tab content.
 */
export function PageTabs(props: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root {...props} />;
}

/**
 * Tab strip for use inside a `PageBar`. Triggers stretch to the bar's full
 * height and the active underline sits on the bar's bottom border.
 */
export function PageBarTabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("-mb-px flex items-stretch gap-4 self-stretch", className)}
      {...props}
    />
  );
}

/** A single tab trigger inside `PageBarTabs`. */
export function PageBarTab({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex cursor-pointer items-center whitespace-nowrap border-b-2 border-transparent font-medium text-muted-foreground text-sm ring-offset-background transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-accent-foreground data-[state=active]:text-foreground",
        className,
      )}
      {...props}
    />
  );
}
