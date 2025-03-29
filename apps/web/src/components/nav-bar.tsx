import { useMe } from "@voidhash/features/auth/hooks/useMe";
import {
	Logo,
	NavSlashSeparator,
	NavUser,
	ProjectSwitcher,
	SidebarTrigger,
	OrganizationSwitcher,
} from "@voidhash/ui";
import { User } from "better-auth";
import { useState } from "react";
import { Building } from "lucide-react";
import { Link, useParams } from "@tanstack/react-router";

export function NavBar({
	user,
	onSignOut,
}: {
	user: User;
	onSignOut: () => void;
}) {
	const userWithAvatar = {
		...user,
		avatar: user.image ?? undefined,
	};

	const { data: me } = useMe();

	const { organizationSlug, projectId } = useParams({
		strict: false,
	});

	const organizations =
		me?.organizations.map((org) => ({
			id: org.id,
			slug: org.slug,
			name: org.name,
			logo: Building,
			plan: "free",
			projects:
				org.projects?.map((project) => ({
					id: project.id,
					name: project.name,
				})) ?? [],
		})) ?? [];

	const activeOrganization = organizations.find(
		(org) => org.slug === organizationSlug
	);

	const activeProject = activeOrganization?.projects.find(
		(project) => project.id === projectId
	);

	const homeLink = (() => {
		if (organizationSlug && !projectId) {
			return {
				to: "/~/$organizationSlug",
				params: {
					organizationSlug,
				},
			} as const;
		}
		if (organizationSlug && projectId) {
			return {
				to: "/~/$organizationSlug/$projectId",
				params: {
					organizationSlug,
					projectId,
				},
			} as const;
		}
		return {
			to: "/",
			params: undefined,
		} as const;
	})();

	if (!activeOrganization) {
		return null;
	}

	return (
		<div className="p-4 border-b border-border w-full fixed top-0 left-0 right-0 bg-background z-50 h-[var(--header-height)] flex items-center justify-between">
			<div className="flex items-center gap-7">
				<SidebarTrigger className="px-4" />
				<Link to={homeLink?.to} params={homeLink?.params}>
					<Logo />
				</Link>
				<div className="flex items-center gap-2">
					<OrganizationSwitcher
						organizations={organizations}
						activeOrganization={activeOrganization}
						activeProject={activeProject}
					/>
					{activeProject && (
						<>
							<NavSlashSeparator />
							<ProjectSwitcher
								organizations={organizations}
								activeOrganization={activeOrganization}
								activeProject={activeProject}
							/>
						</>
					)}
				</div>
			</div>

			<NavUser user={userWithAvatar} onSignOut={onSignOut} />
		</div>
	);
}
