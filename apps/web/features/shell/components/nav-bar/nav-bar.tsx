import { NavBarLogo } from './nav-bar-logo';
import { EnviromentBar } from './nav-environment-bar';
import { NavProjectEnvironment } from './nav-project-environment';
import { NavUser } from './nav-user/nav-user';
import { OrganizationSwitcher } from './organization-switcher';
import { ProjectSwitcher } from './project-switcher';
export function NavBar({
  organizationSlug,
  projectSlug
}: {
  organizationSlug: string | null;
  projectSlug: string | null;
}) {
  return (
    <div className="fixed z-50 flex h-[var(--header-height)] w-full flex-col justify-between border-border border-b bg-background transition-all duration-75">
      <EnviromentBar
        organizationSlug={organizationSlug}
        projectSlug={projectSlug}
      />

      <div className="flex items-center justify-between px-4 py-2 ">
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
