'use client';

import { Slot } from '@radix-ui/react-slot';
import { cn } from '@voidhash/ui';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

const panelButtonVariants = cva(
  'inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-sm font-medium text-xs outline-none transition-all focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary:
          'bg-muted hover:bg-accent hover:text-accent-foreground dark:bg-input/60',
        ghost:
          'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        outline:
          'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground'
      },
      size: {
        default: 'h-7 gap-1.5 px-2',
        icon: 'size-7'
      }
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'default'
    }
  }
);

export type PanelButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof panelButtonVariants> & {
    asChild?: boolean;
    icon?: React.ReactNode;
  };

export function PanelButton({
  className,
  variant,
  size,
  asChild = false,
  icon,
  children,
  ...props
}: PanelButtonProps) {
  const Comp = asChild ? Slot : 'button';
  const isIconOnly = icon && !children;

  return (
    <Comp
      className={cn(
        panelButtonVariants({
          variant,
          size: isIconOnly ? 'icon' : size,
          className
        })
      )}
      type="button"
      {...props}
    >
      {icon ? (
        <span className="flex size-3.5 items-center justify-center [&_svg]:size-3.5">
          {icon}
        </span>
      ) : null}
      {children}
    </Comp>
  );
}

export { panelButtonVariants };
