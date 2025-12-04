"use client";

import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cn } from "@voidhash/ui";
import type * as React from "react";

export type PanelToggleGroupProps = React.ComponentProps<
	typeof ToggleGroupPrimitive.Root
>;

export function PanelToggleGroup({
	className,
	children,
	...props
}: PanelToggleGroupProps) {
	return (
		<ToggleGroupPrimitive.Root
			className={cn(
				"inline-flex h-7 items-center rounded-sm bg-muted dark:bg-input/60",
				className,
			)}
			{...props}
		>
			{children}
		</ToggleGroupPrimitive.Root>
	);
}

export type PanelToggleGroupItemProps = React.ComponentProps<
	typeof ToggleGroupPrimitive.Item
> & {
	icon?: React.ReactNode;
};

export function PanelToggleGroupItem({
	className,
	icon,
	children,
	...props
}: PanelToggleGroupItemProps) {
	const isIconOnly = icon && !children;

	return (
		<ToggleGroupPrimitive.Item
			className={cn(
				"inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap font-medium text-muted-foreground text-xs outline-none transition-all focus-visible:z-10 focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				"rounded-none first:rounded-l-sm last:rounded-r-sm",
				"bg-transparent hover:bg-accent/50 hover:text-accent-foreground",
				"data-[state=on]:bg-accent data-[state=on]:text-accent-foreground",
				isIconOnly ? "h-7" : "h-7 gap-1.5 px-2",
				className,
			)}
			{...props}
		>
			{icon ? (
				<span className="flex size-3.5 items-center justify-center [&_svg]:size-3.5">
					{icon}
				</span>
			) : null}
			{children}
		</ToggleGroupPrimitive.Item>
	);
}
