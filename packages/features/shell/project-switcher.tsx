import * as React from "react";

import {
	GradientAvatar,
	OrganizationProjectSwitcher,
	useSidebar,
} from "@voidhash/ui";
import { Link } from "@tanstack/react-router";

export function ProjectSwitcher({
	organizations,
	activeOrganization,
	activeProject,
	onOrganizationSelected,
	onProjectSelected,
}: {
	activeOrganization: {
		id: string;
		slug: string;
		name: string;
		logo: React.ElementType;
	};
	activeProject?: {
		id: string;
		name: string;
		logo: React.ElementType;
	};
	organizations: {
		id: string;
		name: string;
		logo: React.ElementType;
		plan: string;
		projects: {
			id: string;
			name: string;
			logo: React.ElementType;
		}[];
	}[];
	onOrganizationSelected?: (organization: {
		id: string;
		name: string;
		logo: React.ElementType;
	}) => void;
	onProjectSelected?: (project: {
		id: string;
		name: string;
		logo: React.ElementType;
	}) => void;
}) {
	const { isMobile } = useSidebar();

	if (!activeProject) {
		return null;
	}

	return (
		<div className="flex items-center gap-2">
			<div className="flex items-center gap-2">
				<span className="truncate text-sm text-foreground-">
					{activeProject.name}
				</span>
			</div>
			<Link
				to="/~/$organizationSlug/$projectId"
				params={{
					organizationSlug: activeOrganization.slug,
					projectId: activeProject.id,
				}}
			>
				<div className="flex items-center gap-2">
					<GradientAvatar
						className="h-6 w-6 rounded-lg text-xs"
						src={undefined}
						alt={activeProject.name}
						fallback={activeProject.id}
					/>
					<span className="truncate text-sm text-foreground-">
						{activeProject.name}
					</span>
				</div>
			</Link>
			<OrganizationProjectSwitcher
				organizations={organizations}
				activeOrganization={activeOrganization}
				activeProject={activeProject}
				onOrganizationSelected={onOrganizationSelected}
				onProjectSelected={onProjectSelected}
			/>
		</div>
	);
}
