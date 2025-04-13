"use client";
import * as React from "react";
import { GradientAvatar, Skeleton } from "@voidhash/ui";
import { Sidebar, SidebarContent, SidebarHeader } from "@voidhash/ui";
import { ChevronLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { NavMain } from "./nav-main";
import { getOrganizationBySlug } from "@/lib/queries/cached-queries";
import { Suspense, use } from "react";

const ActiveOrganization = ({
	activeOrganizationPromise,
}: {
	activeOrganizationPromise: ReturnType<typeof getOrganizationBySlug>;
}) => {
	const activeOrganization = use(activeOrganizationPromise);

	if (!activeOrganization) {
		return null;
	}

	return (
		<>
			<GradientAvatar
				className="h-4 w-4 rounded-lg text-xs"
				src={undefined}
				alt={activeOrganization.name}
				fallback={activeOrganization.id}
			/>

			<span className="truncate text-sm text-foreground-">
				{activeOrganization?.name}
			</span>
		</>
	);
};

const ActiveOrganizationSkeleton = () => {
	return (
		<>
			<Skeleton className="h-4 w-4 rounded-lg" />
			<Skeleton className="h-4 w-24 rounded-lg" />
		</>
	);
};

export function ProjectSettingsSidebar({
	activeOrganizationPromise,
	organizationSlug,
	projectSlug,
	...props
}: React.ComponentProps<typeof Sidebar> & {
	activeOrganizationPromise: ReturnType<typeof getOrganizationBySlug>;
	organizationSlug: string;
	projectSlug: string;
}) {
	const pathname = usePathname();

	const data = {
		navMain: [
			{
				title: "Project",
				items: [
					{
						title: "General",
						url: `/${organizationSlug}/${projectSlug}/settings/general`,
						isActive: () =>
							pathname.startsWith(
								`/${organizationSlug}/${projectSlug}/settings/general`
							),
					},
					{
						title: "Payment Providers",
						url: `/${organizationSlug}/${projectSlug}/settings/payment-providers`,
						isActive: () =>
							pathname.startsWith(
								`/${organizationSlug}/${projectSlug}/settings/payment-providers`
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
				<div className="flex w-full items-start justify-start flex-col">
					<Link
						href={`/${organizationSlug}/~/settings/general`}
						className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
					>
						<ChevronLeft className="size-4 -ml-1" />
						<Suspense fallback={<ActiveOrganizationSkeleton />}>
							<ActiveOrganization
								activeOrganizationPromise={activeOrganizationPromise}
							/>
						</Suspense>
					</Link>

					<div className="text-base font-medium text-foreground w-full mt-2">
						Project Settings
					</div>
				</div>
			</SidebarHeader>
			<SidebarContent>
				<NavMain groups={data.navMain} link={Link} tooltips="disabled" />
			</SidebarContent>
		</Sidebar>
	);
}
