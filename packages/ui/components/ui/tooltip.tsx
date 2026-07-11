import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { type ComponentProps, isValidElement, type ReactElement, type ReactNode } from "react";

import { cn } from "../../lib/utils";

const TooltipCreateHandle = TooltipPrimitive.createHandle;

const TooltipRoot = TooltipPrimitive.Root;

type TooltipProviderProps = ComponentProps<typeof TooltipPrimitive.Provider> & {
  /** Backwards-compat alias for `delay` (matches the Radix `TooltipProvider` prop). */
  delayDuration?: number;
};

/**
 * Wraps Base UI's `TooltipProvider` to default the open delay to `0` (matching
 * the previous Radix-based behavior) and accept the legacy `delayDuration` prop.
 */
function TooltipProvider({ delay, delayDuration, ...props }: TooltipProviderProps) {
  return <TooltipPrimitive.Provider delay={delay ?? delayDuration ?? 0} {...props} />;
}

/**
 * Tooltip root. Wraps children with a `TooltipProvider` so isolated tooltips
 * work without an explicit root provider. When many tooltips share a parent,
 * mount a `TooltipProvider` higher in the tree and use `TooltipRoot` directly.
 */
function Tooltip(props: ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  );
}

type TooltipTriggerProps = ComponentProps<typeof TooltipPrimitive.Trigger> & {
  /** Backwards-compat alias for `render` — composes the trigger with its child. */
  asChild?: boolean;
};

function TooltipTrigger({ asChild, render, children, ...props }: TooltipTriggerProps) {
  if (asChild && isValidElement(children)) {
    return (
      <TooltipPrimitive.Trigger
        data-slot="tooltip-trigger"
        render={children as ReactElement<Record<string, unknown>>}
        {...props}
      />
    );
  }
  return (
    <TooltipPrimitive.Trigger data-slot="tooltip-trigger" render={render} {...props}>
      {children}
    </TooltipPrimitive.Trigger>
  );
}

type TooltipPopupProps = TooltipPrimitive.Popup.Props & {
  align?: TooltipPrimitive.Positioner.Props["align"];
  side?: TooltipPrimitive.Positioner.Props["side"];
  sideOffset?: TooltipPrimitive.Positioner.Props["sideOffset"];
  anchor?: TooltipPrimitive.Positioner.Props["anchor"];
};

function TooltipPopup({
  className,
  align = "center",
  sideOffset = 4,
  side = "top",
  anchor,
  children,
  ...props
}: TooltipPopupProps) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        anchor={anchor}
        className="z-50 h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) transition-[top,left,right,bottom,transform] data-instant:transition-none"
        data-slot="tooltip-positioner"
        side={side}
        sideOffset={sideOffset}
      >
        <TooltipPrimitive.Popup
          className={cn(
            "relative flex h-(--popup-height,auto) w-(--popup-width,auto) origin-(--transform-origin) text-balance rounded-md border bg-popover not-dark:bg-clip-padding text-popover-foreground text-xs shadow-md/5 transition-[width,height,scale,opacity] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-md)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] data-ending-style:scale-98 data-starting-style:scale-98 data-ending-style:opacity-0 data-starting-style:opacity-0 data-instant:duration-0 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
            className,
          )}
          data-slot="tooltip-popup"
          {...props}
        >
          <TooltipPrimitive.Viewport
            className="relative size-full overflow-clip px-(--viewport-inline-padding) py-1 [--viewport-inline-padding:--spacing(2)] data-instant:transition-none **:data-current:data-ending-style:opacity-0 **:data-current:data-starting-style:opacity-0 **:data-previous:data-ending-style:opacity-0 **:data-previous:data-starting-style:opacity-0 **:data-current:w-[calc(var(--popup-width)-2*var(--viewport-inline-padding)-2px)] **:data-previous:w-[calc(var(--popup-width)-2*var(--viewport-inline-padding)-2px)] **:data-previous:truncate **:data-current:opacity-100 **:data-previous:opacity-100 **:data-current:transition-opacity **:data-previous:transition-opacity"
            data-slot="tooltip-viewport"
          >
            {children}
          </TooltipPrimitive.Viewport>
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

/**
 * Backwards-compatible alias for {@link TooltipPopup}. New code should prefer
 * `TooltipPopup` to match the upstream Base UI naming.
 */
const TooltipContent = TooltipPopup;

/**
 * Convenience wrapper for the common pattern of tooltipping an icon button.
 * Internally composes `Tooltip` + `TooltipTrigger` + `TooltipPopup`.
 */
function IconButtonTooltip({
  children,
  label,
  ...popupProps
}: {
  children: ReactElement<Record<string, unknown>>;
  label: ReactNode;
} & Omit<TooltipPopupProps, "children">) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipPopup {...popupProps}>{label}</TooltipPopup>
    </Tooltip>
  );
}

export {
  IconButtonTooltip,
  Tooltip,
  TooltipContent,
  TooltipCreateHandle,
  TooltipPopup,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
};
