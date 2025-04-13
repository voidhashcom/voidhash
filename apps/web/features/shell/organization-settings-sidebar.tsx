"use client";
import * as React from "react";
import {
	GradientAvatar,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	Skeleton,
} from "@voidhash/ui";
import { Sidebar, SidebarContent, SidebarHeader } from "@voidhash/ui";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { NavMain } from "./nav-main";
import { Suspense, use } from "react";
import { type getProjectsByOrganizationSlug } from "../projects/server/cached-queries";

const SidebarProjects = ({
	organizationSlug,
	projectsPromise,
}: {
	organizationSlug;
	projectsPromise: ReturnType<typeof getProjectsByOrganizationSlug>;
}) => {
	const projects = use(projectsPromise);
	return (
		<SidebarMenu>
			{projects.map((project) => (
				<SidebarMenuItem key={project.id}>
					<SidebarMenuButton asChild tooltip={null} isActive={false}>
						<Link
							href={`/~/${organizationSlug}/${project.slug}/settings/general`}
						>
							<div className="flex items-center gap-2">
								<GradientAvatar
									className="h-6 w-6 rounded-lg text-xs"
									src={undefined}
									alt={project.name}
									fallback={project.id}
								/>
								<span className="truncate text-sm text-foreground-">
									{project.name}
								</span>
							</div>
						</Link>
					</SidebarMenuButton>
				</SidebarMenuItem>
			))}
		</SidebarMenu>
	);
};

const SidebarProjectsSkeleton = () => {
	return (
		<SidebarMenu>
			{Array.from({ length: 3 }).map((_, index) => (
				<SidebarMenuItem key={index}>
					<SidebarMenuButton asChild tooltip={null} isActive={false}>
						<div className="flex items-center gap-2">
							<Skeleton className="w-6 h-6 rounded-full" />
							<Skeleton className="w-24 h-4" />
						</div>
					</SidebarMenuButton>
				</SidebarMenuItem>
			))}
		</SidebarMenu>
	);
};

export function OrganizationSettingsSidebar({
	projectsPromise,
	...props
}: React.ComponentProps<typeof Sidebar> & {
	projectsPromise: ReturnType<typeof getProjectsByOrganizationSlug>;
}) {
	const pathname = usePathname();
	const { organizationSlug } = useParams();

	const data = {
		navMain: [
			{
				title: "Team",
				items: [
					{
						title: "General",
						url: `/~/${organizationSlug}/settings/general`,
						isActive: () =>
							pathname.startsWith(`/~/${organizationSlug}/settings/general`),
					},
					// TODO: Add members settings and billing
					// {
					// 	title: "Members",
					// 	url: `/~/${organizationSlug}/settings/members`,
					// 	isActive: () =>
					// 		routerState.location.pathname.startsWith(
					// 			`/~/${organizationSlug}/settings/members`
					// 		),
					// },
				],
			},
		],
	};

	if (!organizationSlug) {
		return null;
	}

	return (
		<Sidebar
			variant="inset"
			collapsible="none"
			className="!top-[var(--header-height)] !h-[calc(100svh-var(--header-height))] border-r sticky flex"
			{...props}
		>
			<SidebarHeader className="gap-3.5 border-b p-4">
				<div className="flex w-full items-center justify-between">
					<div className="text-base font-medium text-foreground">
						Team Settings
					</div>
				</div>
			</SidebarHeader>
			<SidebarContent>
				<NavMain groups={data.navMain} link={Link} tooltips="disabled" />
				<SidebarGroup>
					<SidebarGroupLabel>Projects</SidebarGroupLabel>
					<Suspense fallback={<SidebarProjectsSkeleton />}>
						<SidebarProjects
							organizationSlug={organizationSlug}
							projectsPromise={projectsPromise}
						/>
					</Suspense>
				</SidebarGroup>
			</SidebarContent>
		</Sidebar>
	);
}
