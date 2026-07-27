import type * as React from "react";

import { Toggle as TogglePrimitive } from "radix-ui";
import { type VariantProps, cva } from "class-variance-authority";

import { cn } from "../../lib/utils";

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent bg-clip-padding font-medium text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: "h-8 min-w-8 px-2.5",
        lg: "h-9 min-w-9 px-2.5",
        sm: "h-7 min-w-7 px-1.5",
      },
      variant: {
        default:
          "border-border bg-background text-muted-foreground hover:shadow-[inset_0_0_17px_var(--color-input)] hover:text-foreground data-[state=on]:bg-muted data-[state=on]:text-foreground data-[state=on]:shadow-[inset_0_0_17px_color-mix(in_oklch,var(--surface-muted),var(--foreground)_5%)] data-[state=on]:hover:bg-muted data-[state=on]:hover:shadow-[inset_0_0_17px_color-mix(in_oklch,var(--surface-muted),var(--foreground)_5%)] dark:border-input dark:bg-input/30 dark:hover:bg-input/50 dark:data-[state=on]:bg-input/80 dark:data-[state=on]:hover:bg-input/80",
        primary:
          "border-blue-ribbon-500 bg-primary text-primary-foreground hover:shadow-[inset_0_0_17px_var(--color-blue-ribbon-400)] data-[state=on]:border-blue-ribbon-400 data-[state=on]:bg-blue-ribbon-500 data-[state=on]:shadow-[inset_0_0_17px_var(--color-blue-ribbon-300)] data-[state=on]:hover:bg-blue-ribbon-500 data-[state=on]:hover:shadow-[inset_0_0_17px_var(--color-blue-ribbon-300)]",
      },
    },
  },
);

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      className={cn(toggleVariants({ className, size, variant }))}
      data-slot="toggle"
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
