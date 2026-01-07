'use client';

import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import { cn } from '@voidhash/ui';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { createContext, useContext } from 'react';

const designerToggleVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium text-xs outline-none transition-all hover:text-accent-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=on]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-transparent hover:bg-muted data-[state=on]:bg-accent',
        primary:
          'bg-transparent hover:bg-muted data-[state=on]:bg-primary data-[state=on]:text-primary-foreground'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
);

const DesignerToggleGroupContext = createContext<
  VariantProps<typeof designerToggleVariants> & {
    spacing?: number;
  }
>({
  variant: 'default',
  spacing: 0
});

type DesignerToggleGroupProps = React.ComponentProps<
  typeof ToggleGroupPrimitive.Root
> &
  VariantProps<typeof designerToggleVariants> & {
    spacing?: number;
  };

function DesignerToggleGroup({
  className,
  variant,
  spacing = 0,
  children,
  ...props
}: DesignerToggleGroupProps) {
  return (
    <ToggleGroupPrimitive.Root
      className={cn(
        'group/toggle-group flex w-fit items-center rounded-md',
        spacing > 0 && `gap-${spacing}`,
        className
      )}
      data-slot="designer-toggle-group"
      data-spacing={spacing}
      data-variant={variant}
      {...props}
    >
      <DesignerToggleGroupContext.Provider value={{ variant, spacing }}>
        {children}
      </DesignerToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
}

type DesignerToggleGroupItemProps = React.ComponentProps<
  typeof ToggleGroupPrimitive.Item
> &
  VariantProps<typeof designerToggleVariants>;

function DesignerToggleGroupItem({
  className,
  children,
  variant,
  ...props
}: DesignerToggleGroupItemProps) {
  const context = useContext(DesignerToggleGroupContext);

  return (
    <ToggleGroupPrimitive.Item
      className={cn(
        designerToggleVariants({
          variant: context.variant || variant
        }),
        'h-7 min-w-7 shrink-0 px-2',
        'focus:z-10 focus-visible:z-10',
        context.spacing === 0 &&
          'rounded-none shadow-none first:rounded-l-md last:rounded-r-md',
        '[&_svg]:size-4',
        className
      )}
      data-slot="designer-toggle-group-item"
      data-spacing={context.spacing}
      data-variant={context.variant || variant}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  );
}

export {
  DesignerToggleGroup,
  DesignerToggleGroupItem,
  designerToggleVariants
};
