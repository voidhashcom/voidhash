"use client";

import * as React from "react";
import {
	Command,
	GaugeIcon,
	LifeBuoy,
	Send,
	Settings,
	Settings2,
} from "lucide-react";
import { NavMain, NavSecondary, NavUser } from "@voidhash/features/shell";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@voidhash/ui";
import { User } from "better-auth";
import { Link, useRouterState } from "@tanstack/react-router";

export function AppSidebar({
	user,
	onSignOut,
	collapsible = "icon",
	...props
}: React.ComponentProps<typeof Sidebar> & {
	user: User;
	onSignOut: () => void;
}) {
	const userWithAvatar = {
		...user,
		avatar: user.image ?? undefined,
	};

	const routerState = useRouterState();
	const isSettingsRoute = routerState.location.pathname.startsWith("/settings");
	const { setOpen } = useSidebar();
	React.useEffect(() => {
		if (isSettingsRoute) {
			setOpen(false);
		} else if (!isSettingsRoute) {
			setOpen(true);
		}
	}, [isSettingsRoute]);

	const data = {
		user: {
			name: "shadcn",
			email: "m@example.com",
			avatar: "/avatars/shadcn.jpg",
		},
		navMain: [
			{
				title: "Platform",
				items: [
					{
						title: "Overview",
						url: "/dashboard",
						icon: GaugeIcon,
						isActive: () =>
							routerState.location.pathname.startsWith("/dashboard"),
					},
					// {
					// 	title: "Customers",
					// 	url: "#",
					// 	icon: UsersIcon,
					// },
					{
						title: "Settings",
						url: "/settings/general",
						icon: Settings,
						isActive: () =>
							routerState.location.pathname.startsWith("/settings"),
					},
				],
			},
		],
		navSecondary: [
			{
				title: "Support",
				url: "#",
				icon: LifeBuoy,
			},
			{
				title: "Feedback",
				url: "#",
				icon: Send,
			},
		],
	};

	return (
		<Sidebar
			variant="inset"
			collapsible={collapsible}
			className="border-r"
			{...props}
		>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" asChild>
							<a href="#">
								<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
									<Command className="size-4" />
								</div>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-semibold">Acme Inc</span>
									<span className="truncate text-xs">Enterprise</span>
								</div>
							</a>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<NavMain groups={data.navMain} link={Link} />
				<NavSecondary items={data.navSecondary} className="mt-auto" />
			</SidebarContent>
			<SidebarFooter>
				<NavUser user={userWithAvatar} onSignOut={onSignOut} />
			</SidebarFooter>
		</Sidebar>
	);
}
