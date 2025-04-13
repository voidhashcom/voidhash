"use client";

import * as React from "react";
import { Grid2X2, Settings } from "lucide-react";
import { Sidebar, SidebarContent } from "@voidhash/ui";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { NavMain } from "./nav-main";

export function OrganizationSidebar({
	organizationSlug,
	collapsible = "icon",
	...props
}: React.ComponentProps<typeof Sidebar> & {
	organizationSlug: string;
}) {
	const pathname = usePathname();

	const data = {
		navMain: [
			{
				title: "Team",
				items: [
					{
						title: "Projects",
						url: `/${organizationSlug}`,
						icon: Grid2X2,
						isActive: () => pathname === `/${organizationSlug}`,
					},
					{
						title: "Settings",
						url: `/${organizationSlug}/~/settings/general`,
						icon: Settings,
						isActive: () =>
							pathname.startsWith(`/${organizationSlug}/~/settings/general`),
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
