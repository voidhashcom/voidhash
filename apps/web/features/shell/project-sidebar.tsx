"use client";

import * as React from "react";
import {
	GalleryHorizontalEnd,
	GaugeIcon,
	Package2,
	Settings,
	SquareTerminal,
	Users,
} from "lucide-react";
import { Sidebar, SidebarContent, useSidebar } from "@voidhash/ui";
import { NavMain } from "./nav-main";
import { usePathname } from "next/navigation";
import Link from "next/link";

export function ProjectSidebar({
	collapsible = "icon",
	organizationSlug,
	projectSlug,
	...props
}: React.ComponentProps<typeof Sidebar> & {
	organizationSlug: string;
	projectSlug: string;
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
	}, [isSettingsRoute, setOpen]);

	const data = {
		navMain: [
			{
				title: "Platform",
				items: [
					{
						title: "Overview",
						url: `/${organizationSlug}/${projectSlug}`,
						icon: GaugeIcon,
						isActive: () => pathname == `/${organizationSlug}/${projectSlug}`,
					},
					{
						title: "Customers",
						url: `/${organizationSlug}/${projectSlug}/customers`,
						icon: Users,
						isActive: () =>
							pathname.startsWith(
								`/${organizationSlug}/${projectSlug}/customers`
							),
					},
					{
						title: "Products",
						url: `/${organizationSlug}/${projectSlug}/products`,
						icon: Package2,
						isActive: () =>
							pathname.startsWith(
								`/${organizationSlug}/${projectSlug}/products`
							),
					},
					{
						title: "Paywalls",
						url: `/${organizationSlug}/${projectSlug}/paywalls`,
						icon: GalleryHorizontalEnd,
						isActive: () =>
							pathname.startsWith(
								`/${organizationSlug}/${projectSlug}/paywalls`
							),
					},
					{
						title: "Developers",
						url: `/${organizationSlug}/${projectSlug}/developers`,
						icon: SquareTerminal,
						isActive: () =>
							pathname.startsWith(
								`/${organizationSlug}/${projectSlug}/developers`
							),
					},
					{
						title: "Settings",
						url: `/${organizationSlug}/${projectSlug}/settings/general`,
						icon: Settings,
						isActive: () =>
							pathname.startsWith(
								`/${organizationSlug}/${projectSlug}/settings/general`
							),
					},
				],
			},
		],
	};

	return (
		<Sidebar
			variant="inset"
			collapsible={collapsible}
			className="!top-[var(--header-height)] !h-[calc(100svh-var(--header-height))] transition-all duration-75 border-r"
			{...props}
		>
			<SidebarContent>
				<NavMain groups={data.navMain} link={Link} defaultOpenNested={true} />
			</SidebarContent>
		</Sidebar>
	);
}
