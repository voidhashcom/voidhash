import {
	Logo,
	NavSlashSeparator,
	NavUser,
	ProjectSwitcher,
	SidebarTrigger,
	OrganizationSwitcher,
} from "@voidhash/ui";
import { User } from "better-auth";
import { Link } from "@tanstack/react-router";
import { useActiveOrganization } from "@voidhash/features/shell/hooks/useActiveOrganization";
import { useActiveProject } from "@voidhash/features/shell/hooks/useActiveProject";

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

	const activeOrganization = useActiveOrganization();
	const activeProject = useActiveProject();

	const homeLink = (() => {
		if (activeOrganization && !activeProject) {
			return {
				to: "/~/$organizationSlug",
				params: {
					organizationSlug: activeOrganization.slug,
				},
			} as const;
		}
		if (activeOrganization && activeProject) {
			return {
				to: "/~/$organizationSlug/$projectSlug",
				params: {
					organizationSlug: activeOrganization.slug,
					projectSlug: activeProject.slug,
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
				<Link to={homeLink?.to} params={homeLink?.params}>
					<Logo variant="symbol" className="h-4 ml-2" color="mono" />
				</Link>
				<SidebarTrigger className="px-4" />
				<div className="flex items-center gap-2">
					<OrganizationSwitcher />
					{activeProject && (
						<>
							<NavSlashSeparator />
							<ProjectSwitcher />
						</>
					)}
				</div>
			</div>

			<NavUser user={userWithAvatar} onSignOut={onSignOut} />
		</div>
	);
}
