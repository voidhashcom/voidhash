"use client";

import * as React from "react";
import {
	AudioWaveform,
	Command,
	GalleryVerticalEnd,
	GaugeIcon,
	Grid2X2,
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
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";

export function OrganizationSidebar({
	user,
	onSignOut,
	collapsible = "icon",
	...props
}: React.ComponentProps<typeof Sidebar> & {
	user: User;
	onSignOut: () => void;
}) {
	const pathname = usePathname();
	const isSettingsRoute = pathname.includes("/settings");
	const { setOpen } = useSidebar();
	React.useEffect(() => {
		if (isSettingsRoute) {
			setOpen(false);
		} else if (!isSettingsRoute) {
			setOpen(true);
		}
	}, [isSettingsRoute]);

	const { organizationSlug } = useParams();

	const data = {
		navMain: [
			{
				title: "Team",
				items: [
					{
						title: "Projects",
						url: `/~/${organizationSlug}/projects`,
						icon: Grid2X2,
						isActive: () =>
							pathname.startsWith(`/~/${organizationSlug}/projects`),
					},
					{
						title: "Settings",
						url: `/~/${organizationSlug}/settings/general`,
						icon: Settings,
						isActive: () =>
							pathname.startsWith(`/~/${organizationSlug}/settings/general`),
					},
				],
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
			</SidebarContent>
		</Sidebar>
	);
}
