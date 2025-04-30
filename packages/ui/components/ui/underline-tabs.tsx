"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "../../lib/utils";

function UnderlineTabs({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
	return (
		<TabsPrimitive.Root
			className={cn("flex flex-col gap-2 w-full", className)}
			{...props}
		/>
	);
}

function UnderlineTabsList({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
	return (
		<TabsPrimitive.List
			className={cn(
				"inline-flex items-center p-0 bg-background justify-start border-b rounded-none w-full space-x-4",
				className
			)}
			{...props}
		/>
	);
}

function UnderlineTabsTrigger({
	className,
	children,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
	return (
		<TabsPrimitive.Trigger
			className={cn(
				"inline-flex items-center justify-center whitespace-nowrap rounded-none bg-background py-3 cursor-pointer text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-accent-foreground text-muted-foreground data-[state=active]:text-foreground",
				className
			)}
			{...props}
		>
			{children}
		</TabsPrimitive.Trigger>
	);
}

function UnderlineTabsContent({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
	return (
		<TabsPrimitive.Content
			className={cn(
				"mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
				className
			)}
			{...props}
		/>
	);
}

export {
	UnderlineTabs,
	UnderlineTabsList,
	UnderlineTabsTrigger,
	UnderlineTabsContent,
};
