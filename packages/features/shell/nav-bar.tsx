"use client";

import {
	Logo,
	NavSlashSeparator,
	NavUser,
	ProjectSwitcher,
	SidebarTrigger,
	OrganizationSwitcher,
} from "@voidhash/ui";
import { User } from "better-auth";
import { useActiveOrganization } from "./hooks/useActiveOrganization";
import { useActiveProject } from "./hooks/useActiveProject";
import Link from "next/link";
import { useParams } from "next/navigation";

export function NavBar({
	onSignOut,
}: {
	onSignOut: () => void;
}) {
	const { organizationSlug, projectSlug } = useParams();

	const { activeOrganization } = useActiveOrganization();
	const { activeProject } = useActiveProject();

	const homeLink = (() => {
		if (activeOrganization && !activeProject) {
			return {
				href: `/~/${activeOrganization.slug}`,
			} as const;
		}
		if (activeOrganization && activeProject) {
			return {
				href: `/~/${activeOrganization.slug}/${activeProject.slug}`,
			} as const;
		}
		return {
			href: "/",
		} as const;
	})();

	return (
		<div className="p-4 border-b border-border w-full fixed top-0 left-0 right-0 bg-background z-50 h-[var(--header-height)] flex items-center justify-between">
			<div className="flex items-center gap-7">
				<Link href={homeLink?.href}>
					<Logo variant="symbol" className="h-4 ml-2" color="mono" />
				</Link>
				<SidebarTrigger className="px-4" />
				<div className="flex items-center gap-2">
					{organizationSlug && <OrganizationSwitcher />}
					{projectSlug && (
						<>
							<NavSlashSeparator />
							<ProjectSwitcher />
						</>
					)}
				</div>
			</div>

			<NavUser onSignOut={onSignOut} />
		</div>
	);
}
