"use client";
import * as React from "react";
import { GradientAvatar, Skeleton } from "@voidhash/ui";
import { Sidebar, SidebarContent, SidebarHeader } from "@voidhash/ui";
import { ChevronLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { NavMain } from "./nav-main";
import { type getOrganizationBySlug } from "@/lib/services/organizations/queries";
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
		<div className="flex items-center gap-2 group">
			<ChevronLeft className="size-4 -ml-1 opacity-0 group-hover:opacity-100 transition-opacity absolute" />
			<GradientAvatar
				className="h-4 w-4 rounded-lg text-xs scale-100 group-hover:opacity-0 transition-all group-hover:scale-0"
				src={undefined}
				alt={activeOrganization.name}
				fallback={activeOrganization.id}
			/>

			<span className="truncate text-sm text-foreground-">
				{activeOrganization?.name}
			</span>
		</div>
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
						title: "API Keys",
						url: `/${organizationSlug}/${projectSlug}/settings/api-keys`,
						isActive: () =>
							pathname.startsWith(
								`/${organizationSlug}/${projectSlug}/settings/api-keys`
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
