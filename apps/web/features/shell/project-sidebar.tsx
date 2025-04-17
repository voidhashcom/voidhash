"use client";

import * as React from "react";
import {
	GaugeIcon,
	LifeBuoy,
	Repeat,
	Send,
	Settings,
	Store,
	Users,
} from "lucide-react";
import { Sidebar, SidebarContent, useSidebar } from "@voidhash/ui";
import { NavMain } from "./nav-main";
import { NavSecondary } from "./nav-secondary";
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
					// {
					// 	title: "Transactions",
					// 	url: `/${organizationSlug}/${projectSlug}/transactions`,
					// 	icon: Repeat,
					// 	isActive: () =>
					// 		pathname.startsWith(
					// 			`/${organizationSlug}/${projectSlug}/transactions`
					// 		),
					// },
					{
						title: "Storefront",
						icon: Store,
						url: `/${organizationSlug}/${projectSlug}/storefront/payment-providers`,
						isActive: () =>
							pathname.startsWith(
								`/${organizationSlug}/${projectSlug}/storefront`
							),
						items: [
							{
								title: "Payment Providers",
								url: `/${organizationSlug}/${projectSlug}/storefront/payment-providers`,
								isActive: () =>
									pathname.startsWith(
										`/${organizationSlug}/${projectSlug}/storefront/payment-providers`
									),
							},
							{
								title: "Products",
								url: `/${organizationSlug}/${projectSlug}/storefront/products`,
								isActive: () =>
									pathname.startsWith(
										`/${organizationSlug}/${projectSlug}/storefront/products`
									),
							},
							// {
							// 	title: "Access Levels",
							// 	url: `/${organizationSlug}/${projectSlug}/storefront/access-levels`,
							// 	isActive: () =>
							// 		pathname.startsWith(
							// 			`/${organizationSlug}/${projectSlug}/storefront/access-levels`
							// 		),
							// },
						],
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
