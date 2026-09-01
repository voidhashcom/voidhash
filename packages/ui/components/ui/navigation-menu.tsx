import { NavigationMenu as NavigationMenuPrimitive } from "@base-ui/react/navigation-menu";
import { cva } from "class-variance-authority";
import { ChevronDownIcon } from "lucide-react";
import { isValidElement } from "react";

import { cn } from "../../lib/utils";

type NavigationMenuProps = NavigationMenuPrimitive.Root.Props &
  Pick<NavigationMenuPrimitive.Positioner.Props, "align" | "side" | "sideOffset"> & {
    /**
     * Class applied to the portaled popup. The popup renders outside the
     * trigger's subtree, so pass `dark` here to theme it independently.
     */
    popupClassName?: string;
  };

/**
 * Navigation menu root. Renders its own portaled positioner, so consumers only
 * compose `NavigationMenuList` and `NavigationMenuItem` as children.
 */
function NavigationMenu({
  align = "start",
  side,
  sideOffset,
  className,
  children,
  popupClassName,
  ...props
}: NavigationMenuProps) {
  return (
    <NavigationMenuPrimitive.Root
      className={cn(
        "group/navigation-menu relative flex max-w-max flex-1 items-center justify-center",
        className,
      )}
      data-slot="navigation-menu"
      {...props}
    >
      {children}
      <NavigationMenuPositioner
        align={align}
        popupClassName={popupClassName}
        side={side}
        sideOffset={sideOffset}
      />
    </NavigationMenuPrimitive.Root>
  );
}

function NavigationMenuList({ className, ...props }: NavigationMenuPrimitive.List.Props) {
  return (
    <NavigationMenuPrimitive.List
      className={cn("group flex flex-1 list-none items-center justify-center", className)}
      data-slot="navigation-menu-list"
      {...props}
    />
  );
}

function NavigationMenuItem({ className, ...props }: NavigationMenuPrimitive.Item.Props) {
  return (
    <NavigationMenuPrimitive.Item
      className={cn("relative", className)}
      data-slot="navigation-menu-item"
      {...props}
    />
  );
}

const navigationMenuTriggerStyle = cva(
  "group/navigation-menu-trigger inline-flex h-9 w-max items-center justify-center rounded-lg px-2.5 py-1.5 font-medium text-sm outline-none ring-ring/50 transition-all hover:bg-muted focus:bg-muted focus-visible:outline-1 focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50 data-popup-open:bg-muted/50 data-popup-open:hover:bg-muted",
);

function NavigationMenuTrigger({
  className,
  children,
  ...props
}: NavigationMenuPrimitive.Trigger.Props) {
  return (
    <NavigationMenuPrimitive.Trigger
      className={cn(navigationMenuTriggerStyle(), className)}
      data-slot="navigation-menu-trigger"
      {...props}
    >
      {children}{" "}
      <ChevronDownIcon
        aria-hidden="true"
        className="relative top-px ml-1 size-3 transition duration-300 group-data-popup-open/navigation-menu-trigger:rotate-180"
      />
    </NavigationMenuPrimitive.Trigger>
  );
}

function NavigationMenuContent({ className, ...props }: NavigationMenuPrimitive.Content.Props) {
  return (
    <NavigationMenuPrimitive.Content
      className={cn(
        "h-full w-auto p-1 ease-[cubic-bezier(0.22,1,0.36,1)] **:data-[slot=navigation-menu-link]:focus:outline-none **:data-[slot=navigation-menu-link]:focus:ring-0",
        "transition-[opacity,transform,translate] duration-[0.35s] data-ending-style:opacity-0 data-starting-style:opacity-0",
        "data-starting-style:data-[activation-direction=left]:-translate-x-1/2 data-ending-style:data-[activation-direction=right]:-translate-x-1/2 data-ending-style:data-[activation-direction=left]:translate-x-1/2 data-starting-style:data-[activation-direction=right]:translate-x-1/2",
        className,
      )}
      data-slot="navigation-menu-content"
      {...props}
    />
  );
}

type NavigationMenuPositionerProps = NavigationMenuPrimitive.Positioner.Props & {
  /** Class applied to the popup rendered inside the positioner. */
  popupClassName?: string;
};

/**
 * Portals and positions the shared popup that every `NavigationMenuContent`
 * animates through. Rendered automatically by {@link NavigationMenu}.
 */
function NavigationMenuPositioner({
  className,
  popupClassName,
  side = "bottom",
  sideOffset = 8,
  align = "start",
  alignOffset = 0,
  ...props
}: NavigationMenuPositionerProps) {
  return (
    <NavigationMenuPrimitive.Portal>
      <NavigationMenuPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        className={cn(
          "isolate z-50 h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) transition-[top,left,right,bottom] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-instant:transition-none",
          className,
        )}
        data-slot="navigation-menu-positioner"
        side={side}
        sideOffset={sideOffset}
        {...props}
      >
        <NavigationMenuPrimitive.Popup
          className={cn(
            "data-ending-style:scale-90 data-starting-style:scale-90 relative h-(--popup-height) w-(--popup-width) origin-(--transform-origin) rounded-lg bg-popover/70 text-popover-foreground shadow-md outline-none ring-1 ring-foreground/10 backdrop-blur-md transition-[opacity,transform,width,height,scale,translate] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:duration-150",
            popupClassName,
          )}
          data-slot="navigation-menu-popup"
        >
          <NavigationMenuPrimitive.Viewport
            className="relative size-full overflow-hidden"
            data-slot="navigation-menu-viewport"
          />
        </NavigationMenuPrimitive.Popup>
      </NavigationMenuPrimitive.Positioner>
    </NavigationMenuPrimitive.Portal>
  );
}

type NavigationMenuLinkProps = NavigationMenuPrimitive.Link.Props & {
  /** Backwards-compat alias for `render` — composes the link with its child. */
  asChild?: boolean;
};

const navigationMenuLinkStyle = cva(
  "flex items-center gap-2 rounded-lg p-2 text-sm outline-none ring-ring/50 transition-all hover:bg-muted focus:bg-muted focus-visible:outline-1 focus-visible:ring-3 data-active:bg-muted/50 data-active:focus:bg-muted data-active:hover:bg-muted in-data-[slot=navigation-menu-content]:rounded-md [&_svg:not([class*='size-'])]:size-4",
);

function NavigationMenuLink({
  asChild,
  className,
  children,
  render,
  ...props
}: NavigationMenuLinkProps) {
  if (asChild && isValidElement<Record<string, unknown>>(children)) {
    return (
      <NavigationMenuPrimitive.Link
        className={cn(navigationMenuLinkStyle(), className)}
        data-slot="navigation-menu-link"
        render={children}
        {...props}
      />
    );
  }
  return (
    <NavigationMenuPrimitive.Link
      className={cn(navigationMenuLinkStyle(), className)}
      data-slot="navigation-menu-link"
      render={render}
      {...props}
    >
      {children}
    </NavigationMenuPrimitive.Link>
  );
}

function NavigationMenuIndicator({ className, ...props }: NavigationMenuPrimitive.Icon.Props) {
  return (
    <NavigationMenuPrimitive.Icon
      className={cn(
        "top-full z-1 flex h-1.5 items-end justify-center overflow-hidden",
        "data-ending-style:opacity-0 data-starting-style:opacity-0 transition-opacity",
        className,
      )}
      data-slot="navigation-menu-indicator"
      {...props}
    >
      <div className="relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm bg-border shadow-md" />
    </NavigationMenuPrimitive.Icon>
  );
}

export {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuPositioner,
  NavigationMenuTrigger,
  navigationMenuLinkStyle,
  navigationMenuTriggerStyle,
};
