import { NavBarLogo } from "./nav-bar-logo";
import { OrganizationSwitcher } from "./organization-switcher";
import { NavUser } from "./nav-user/nav-user";
import { ProjectSwitcher } from "./project-switcher";
import { NavProjectEnvironment } from "./nav-project-environment";
import { EnviromentBar } from "./nav-environment-bar";

export async function NavBar({
	organizationSlug,
	projectSlug,
}: { organizationSlug: string | null; projectSlug: string | null }) {
	return (
		<div className="p-4 border-b border-border w-full fixed top-0 left-0 right-0 bg-background z-50 h-[var(--header-height)] flex items-center justify-between">
			<div className="flex items-center gap-7">
				<NavBarLogo
					organizationSlug={organizationSlug}
					projectSlug={projectSlug}
				/>
				{/* <SidebarTrigger className="px-4" /> */}
				<div className="flex items-center gap-2">
					<OrganizationSwitcher organizationSlug={organizationSlug} />
					<ProjectSwitcher
						organizationSlug={organizationSlug}
						projectSlug={projectSlug}
					/>
				</div>
			</div>
			<EnviromentBar
				organizationSlug={organizationSlug}
				projectSlug={projectSlug}
			/>
			<div className="flex items-center gap-6">
				<NavProjectEnvironment
					organizationSlug={organizationSlug}
					projectSlug={projectSlug}
				/>
				<NavUser />
			</div>
		</div>
	);
}
