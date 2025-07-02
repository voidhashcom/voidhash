"use client";
import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import {
	Button,
	Popover,
	PopoverContent,
	PopoverTrigger,
	GradientAvatar,
	cn,
} from "@voidhash/ui";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../../../trpc/react";
import { CreateOrganizationModal } from "../../../organizations/create-organization-modal";
import { CreateProjectModal } from "../../../projects/create-project-modal";
import type { Organization, Project } from "@voidhash/db";

function OrganizationProjectSwitcherProjects({
	organizationId,
	organizationSlug,
	activeProjectId,
	onProjectClick,
}: {
	organizationId: string;
	organizationSlug: string;
	activeProjectId?: string;
	onProjectClick?: () => void;
}) {
	const trpc = useTRPC();
	const { data } = useQuery(
		trpc.projects.getTeamsProjectsBySlug.queryOptions({
			organizationSlug: organizationSlug,
		})
	);
	const projects = data ?? [];

	// Create project modal
	const [createProjectModalOpen, setCreateProjectModalOpen] =
		React.useState(false);

	return (
		<div className="w-56 bg-accent/30">
			<div className="px-2 py-1.5 text-xs text-muted-foreground">Projects</div>
			{(projects ?? []).map((project) => (
				<Link
					key={project.id}
					href={`/${organizationSlug}/${project.slug}`}
					onClick={onProjectClick}
					className="flex w-full items-center gap-2 p-2 hover:bg-accent text-foreground hover:text-accent-foreground text-sm"
				>
					<GradientAvatar
						className="h-6 w-6 rounded-lg text-xs"
						src={undefined}
						alt={project.name}
						fallback={project.id}
					/>
					{project.name}
					{project.id === activeProjectId && (
						<Check className="ml-auto h-4 w-4" />
					)}
				</Link>
			))}
			<div className="h-px bg-border" />
			<CreateProjectModal
				organizationId={organizationId}
				organizationSlug={organizationSlug}
				open={createProjectModalOpen}
				onClose={() => setCreateProjectModalOpen(false)}
				trigger={
					<button
						onClick={() => setCreateProjectModalOpen(true)}
						className="flex w-full items-center gap-2 p-2 hover:bg-accent hover:text-accent-foreground cursor-pointer"
					>
						<div className="flex size-6 items-center justify-center rounded-md border bg-background">
							<Plus className="size-4 text-muted-foreground" />
						</div>
						<div className="text-sm">Add project</div>
					</button>
				}
			/>
		</div>
	);
}

export function OrganizationProjectSwitcher({
	user,
	activeProject,
	activeOrganization,
}: {
	user: {
		organizations: Organization[];
	};
	activeProject: Project | null;
	activeOrganization: Organization;
}) {
	const [open, setOpen] = React.useState(false);
	const me = user;

	const organizations = me?.organizations ?? [];

	// Highlight organization
	const [highlightedOrganizationIndex, setHighlightedOrganizationIndex] =
		React.useState<number | null>(null);
	const highlightedOrganization =
		highlightedOrganizationIndex !== null
			? organizations[highlightedOrganizationIndex]
			: null;

	const [createOrganizationModalOpen, setCreateOrganizationModalOpen] =
		React.useState(false);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					size={"icon"}
					variant={"ghost"}
					className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground focus-visible:ring-0 px-1"
				>
					<ChevronsUpDown className="text-muted-foreground" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="w-[--radix-popover-trigger-width] min-w-56 rounded-lg p-0"
				align="start"
				side={"bottom"}
				sideOffset={4}
			>
				{activeOrganization && (
					<div
						className="flex flex-row divide-x divide-border"
						onMouseLeave={() => setHighlightedOrganizationIndex(null)}
					>
						<div className="w-56">
							<div className="px-2 py-1.5 text-xs text-muted-foreground">
								Teams
							</div>
							{organizations.map((organization, index) => (
								<Link
									key={organization.name}
									href={`/${organization.slug}`}
									onClick={() => setOpen(false)}
									onMouseEnter={() => setHighlightedOrganizationIndex(index)}
									className={cn(
										"flex w-full items-center gap-2 p-2 hover:bg-accent/50 text-foreground hover:text-accent-foreground text-sm",
										organization.slug ===
											(highlightedOrganization?.slug ??
												activeOrganization?.slug) && "bg-accent/50"
									)}
								>
									<GradientAvatar
										className="h-6 w-6 rounded-lg text-xs"
										src={undefined}
										alt={organization.name}
										fallback={organization.id}
									/>
									{organization.name}
									{organization.slug === activeOrganization.slug && (
										<Check className="ml-auto h-4 w-4" />
									)}
								</Link>
							))}
							<div className="h-px bg-border" />
							<CreateOrganizationModal
								open={createOrganizationModalOpen}
								onClose={() => setCreateOrganizationModalOpen(false)}
								trigger={
									<button
										onClick={() => setCreateOrganizationModalOpen(true)}
										className="flex w-full items-center gap-2 p-2 hover:bg-accent/50 hover:text-accent-foreground cursor-pointer"
									>
										<div className="flex size-6 items-center justify-center rounded-md border bg-background">
											<Plus className="size-4 text-muted-foreground" />
										</div>
										<div className=" text-sm">Add team</div>
									</button>
								}
							/>
						</div>
						{(highlightedOrganization || activeProject) && (
							<OrganizationProjectSwitcherProjects
								organizationId={
									highlightedOrganization?.id ?? activeOrganization.id
								}
								organizationSlug={
									highlightedOrganization?.slug ??
									activeOrganization.slug ??
									"-"
								}
								activeProjectId={activeProject?.id}
								onProjectClick={() => setOpen(false)}
							/>
						)}
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
}
