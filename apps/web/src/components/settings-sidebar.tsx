"use client";

import * as React from "react";

import { NavMain } from "@voidhash/features/shell";
import { Sidebar, SidebarContent, SidebarHeader } from "@voidhash/ui";
import { User } from "better-auth";
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
						url: "#",
					},
					{
						title: "Billing",
						url: "#",
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
		<Sidebar collapsible="none" className="border-r">
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
