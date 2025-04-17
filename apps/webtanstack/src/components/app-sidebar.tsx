"use client";

import * as React from "react";
import {
	GaugeIcon,
	LifeBuoy,
	Repeat,
	Send,
	Settings,
	Users,
} from "lucide-react";
import { NavMain, NavSecondary } from "@voidhash/ui";
import { Sidebar, SidebarContent, useSidebar } from "@voidhash/ui";
import { User } from "better-auth";
import { Link, useParams, useRouterState } from "@tanstack/react-router";

export function AppSidebar({
	user,
	onSignOut,
	collapsible = "icon",
	...props
}: React.ComponentProps<typeof Sidebar> & {
	user: User;
	onSignOut: () => void;
}) {
	const routerState = useRouterState();
	const isSettingsRoute = routerState.location.pathname.includes("/settings");
	const { setOpen } = useSidebar();
	React.useEffect(() => {
		if (isSettingsRoute) {
			setOpen(false);
		} else if (!isSettingsRoute) {
			setOpen(true);
		}
	}, [isSettingsRoute]);

	const { organizationSlug, projectSlug } = useParams({
		strict: false,
	});

	const data = {
		navMain: [
			{
				title: "Platform",
				items: [
					{
						title: "Overview",
						url: `/~/${organizationSlug}/${projectSlug}/dashboard`,
						icon: GaugeIcon,
						isActive: () =>
							routerState.location.pathname.startsWith(
								`/~/${organizationSlug}/${projectSlug}/dashboard`
							),
					},
					{
						title: "Customers",
						url: `/~/${organizationSlug}/${projectSlug}/customers`,
						icon: Users,
						isActive: () =>
							routerState.location.pathname.startsWith(
								`/~/${organizationSlug}/${projectSlug}/customers`
							),
					},
					{
						title: "Transactions",
						url: `/~/${organizationSlug}/${projectSlug}/transactions`,
						icon: Repeat,
						isActive: () =>
							routerState.location.pathname.startsWith(
								`/~/${organizationSlug}/${projectSlug}/transactions`
							),
					},
					{
						title: "Setup"
					}
					{
						title: "Settings",
						url: `/~/${organizationSlug}/${projectSlug}/settings/general`,
						icon: Settings,
						isActive: () =>
							routerState.location.pathname.startsWith(
								`/~/${organizationSlug}/${projectSlug}/settings/general`
							),
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
		</Sidebar>
	);
}
