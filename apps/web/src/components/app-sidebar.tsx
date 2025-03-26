"use client";

import * as React from "react";
import {
	AudioWaveform,
	Command,
	GalleryVerticalEnd,
	GaugeIcon,
	LifeBuoy,
	Send,
	Settings,
} from "lucide-react";
import { NavMain, NavSecondary, NavUser } from "@voidhash/ui";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
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
						url: "/settings/team/general",
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
			className="!top-[var(--header-height)] !h-[calc(100svh-var(--header-height))] border-r"
			{...props}
		>
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
