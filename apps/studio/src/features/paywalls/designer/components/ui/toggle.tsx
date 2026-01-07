"use client";

import type * as React from "react";

import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cn } from "@voidhash/ui";
import { type VariantProps, cva } from "class-variance-authority";

const panelToggleVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-sm font-medium text-xs outline-none transition-all focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: "h-7 gap-1.5 px-2",
        icon: "size-7",
      },
      variant: {
        default:
          "bg-muted hover:bg-accent hover:text-accent-foreground data-[state=on]:bg-accent data-[state=on]:text-accent-foreground dark:bg-input/60",
        ghost:
          "hover:bg-accent hover:text-accent-foreground data-[state=on]:bg-accent data-[state=on]:text-accent-foreground dark:hover:bg-accent/50",
        primary:
          "bg-muted hover:bg-accent hover:text-accent-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground dark:bg-input/60",
      },
    },
  }
);

export type PanelToggleProps = React.ComponentProps<
  typeof TogglePrimitive.Root
> &
  VariantProps<typeof panelToggleVariants> & {
    icon?: React.ReactNode;
  };

export function PanelToggle({
  className,
  variant,
  size,
  icon,
  children,
  ...props
}: PanelToggleProps) {
  const isIconOnly = icon && !children;

  return (
    <TogglePrimitive.Root
      className={cn(
        panelToggleVariants({
          className,
          size: isIconOnly ? "icon" : size,
          variant,
        })
      )}
      {...props}
    >
      {icon ? (
        <span className="flex size-3.5 items-center justify-center [&_svg]:size-3.5">
          {icon}
        </span>
      ) : null}
      {children}
    </TogglePrimitive.Root>
  );
}

export { panelToggleVariants };
