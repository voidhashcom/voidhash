import * as React from "react";
import { NavMain } from "@voidhash/ui";
import { Sidebar, SidebarContent, SidebarHeader } from "@voidhash/ui";
import { Link, useRouterState } from "@tanstack/react-router";

export function SettingsSidebar({
	...props
}: React.ComponentProps<typeof Sidebar>) {
	const routerState = useRouterState();
	const data = {
		navMain: [
			{
				title: "User",
				items: [
					{
						title: "General",
						url: "#",
					},
				],
			},
			{
				title: "Team",
				items: [
					{
						title: "General",
						url: "/settings/team/general",
						isActive: () =>
							routerState.location.pathname.startsWith(
								"/settings/team/general"
							),
					},
					{
						title: "Members",
						url: "/settings/team/members",
						isActive: () =>
							routerState.location.pathname.startsWith(
								"/settings/team/members"
							),
					},
				],
			},
		],
	};

	return (
		<Sidebar
			variant="inset"
			collapsible="none"
			className="!top-[var(--header-height)] !h-[calc(100svh-var(--header-height))] border-r sticky flex"
			{...props}
		>
			<SidebarHeader className="gap-3.5 border-b p-4">
				<div className="flex w-full items-center justify-between">
					<div className="text-base font-medium text-foreground">Settings</div>
				</div>
			</SidebarHeader>
			<SidebarContent>
				<NavMain groups={data.navMain} link={Link} tooltips="disabled" />
			</SidebarContent>
		</Sidebar>
	);
}
