import * as React from "react";
import { GradientAvatar, NavMain } from "@voidhash/ui";
import { Sidebar, SidebarContent, SidebarHeader } from "@voidhash/ui";
import { Link, useParams, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ChevronLeft } from "lucide-react";
import { useActiveOrganization } from "@voidhash/features/shell/hooks/useActiveOrganization";

export function ProjectSettingsSidebar({
	...props
}: React.ComponentProps<typeof Sidebar>) {
	const routerState = useRouterState();
	const { organizationSlug, projectSlug } = useParams({
		strict: false,
	});

	const activeOrganization = useActiveOrganization();

	const data = {
		navMain: [
			{
				title: "Project",
				items: [
					{
						title: "General",
						url: `/~/${organizationSlug}/${projectSlug}/settings/general`,
						isActive: () =>
							routerState.location.pathname.startsWith(
								`/~/${organizationSlug}/${projectSlug}/settings/general`
							),
					},
					{
						title: "Payment Providers",
						url: `/~/${organizationSlug}/${projectSlug}/settings/payment-providers`,
						isActive: () =>
							routerState.location.pathname.startsWith(
								`/~/${organizationSlug}/${projectSlug}/settings/payment-providers`
							),
					},
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
				<div className="flex w-full items-start justify-start flex-col">
					{activeOrganization && (
						<Link
							to="/~/$organizationSlug/settings/general"
							params={{ organizationSlug }}
							className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
						>
							<ChevronLeft className="size-4 -ml-1" />

							<GradientAvatar
								className="h-4 w-4 rounded-lg text-xs"
								src={undefined}
								alt={activeOrganization.name}
								fallback={activeOrganization.id}
							/>
							<span className="truncate text-sm text-foreground-">
								{activeOrganization.name}
							</span>
						</Link>
					)}
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
