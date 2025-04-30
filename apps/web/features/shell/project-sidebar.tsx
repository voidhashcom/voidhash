"use client";

import * as React from "react";
import { GaugeIcon, Settings, Store, Users } from "lucide-react";
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
						url: `/${organizationSlug}/${projectSlug}/customers/list`,
						icon: Users,
						isActive: () =>
							pathname.startsWith(
								`/${organizationSlug}/${projectSlug}/customers`
							),
						items: [
							{
								title: "All Customers",
								url: `/${organizationSlug}/${projectSlug}/customers/list`,
								isActive: () =>
									pathname.startsWith(
										`/${organizationSlug}/${projectSlug}/customers/list`
									),
							},
							// {
							// 	title: "Access Levels",
							// 	url: `/${organizationSlug}/${projectSlug}/customers/access-levels`,
							// 	isActive: () =>
							// 		pathname.startsWith(
							// 			`/${organizationSlug}/${projectSlug}/customers/access-levels`
							// 		),
							// },
						],
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
						title: "Monetization",
						icon: Store,
						url: `/${organizationSlug}/${projectSlug}/monetization/payment-providers`,
						isActive: () =>
							pathname.startsWith(
								`/${organizationSlug}/${projectSlug}/monetization`
							),
						items: [
							{
								title: "Payment Providers",
								url: `/${organizationSlug}/${projectSlug}/monetization/payment-providers`,
								isActive: () =>
									pathname.startsWith(
										`/${organizationSlug}/${projectSlug}/monetization/payment-providers`
									),
							},
							{
								title: "Products",
								url: `/${organizationSlug}/${projectSlug}/monetization/products`,
								isActive: () =>
									pathname.startsWith(
										`/${organizationSlug}/${projectSlug}/monetization/products`
									),
							},
							{
								title: "Perks",
								url: `/${organizationSlug}/${projectSlug}/monetization/perks`,
								isActive: () =>
									pathname.startsWith(
										`/${organizationSlug}/${projectSlug}/monetization/perks`
									),
							},
							{
								title: "Paywalls",
								url: `/${organizationSlug}/${projectSlug}/monetization/paywalls`,
								isActive: () =>
									pathname.startsWith(
										`/${organizationSlug}/${projectSlug}/monetization/paywalls`
									),
							},
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
	};

	return (
		<Sidebar
			variant="inset"
			collapsible={collapsible}
			className="!top-[var(--header-height)] !h-[calc(100svh-var(--header-height))] border-r"
			{...props}
		>
			<SidebarContent>
				<NavMain groups={data.navMain} link={Link} defaultOpenNested={true} />
			</SidebarContent>
		</Sidebar>
	);
}
