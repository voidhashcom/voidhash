import * as React from "react";
import {
	GradientAvatar,
	NavMain,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@voidhash/ui";
import { Sidebar, SidebarContent, SidebarHeader } from "@voidhash/ui";
import { Link, useParams, useRouterState } from "@tanstack/react-router";

export function OrganizationSettingsSidebar({
	...props
}: React.ComponentProps<typeof Sidebar>) {
	const routerState = useRouterState();
	const { organizationSlug } = useParams({
		from: "/_authed/~/$organizationSlug",
	});

	const data = {
		navMain: [
			{
				title: "Team",
				items: [
					{
						title: "General",
						url: `/~/${organizationSlug}/settings/general`,
						isActive: () =>
							routerState.location.pathname.startsWith(
								`/~/${organizationSlug}/settings/general`
							),
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
		projects: [
			{
				id: "1",
				name: "Project 1",
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
					<SidebarMenu>
						{data.projects.map((project) => (
							<SidebarMenuItem>
								<SidebarMenuButton asChild tooltip={null} isActive={false}>
									<Link
										to="/~/$organizationSlug/$projectId"
										params={{
											organizationSlug: organizationSlug,
											projectId: project.id,
										}}
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
				</SidebarGroup>
			</SidebarContent>
		</Sidebar>
	);
}
