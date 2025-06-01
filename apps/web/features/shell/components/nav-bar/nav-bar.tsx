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
		<div className="flex flex-col h-[var(--header-height)] transition-all duration-300 border-b border-border w-full fixed bg-background z-50 justify-between">
			<EnviromentBar
				organizationSlug={organizationSlug}
				projectSlug={projectSlug}
			/>

			<div className="px-4 py-2  flex items-center justify-between ">
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

				<div className="flex items-center gap-6">
					<NavProjectEnvironment
						organizationSlug={organizationSlug}
						projectSlug={projectSlug}
					/>
					<NavUser />
				</div>
			</div>
		</div>
	);
}
