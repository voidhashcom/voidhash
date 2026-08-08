import { FeedbackButton } from "@/features/studio/feedback/feedback-button";

import { NavUser } from "./nav-user/nav-user";
import { ProjectSwitcher } from "./project-switcher";
export function NavBar({
  organizationSlug,
  projectSlug,
}: {
  organizationSlug: string | null;
  projectSlug: string | null;
}) {
  return (
    <div className="fixed z-50 flex h-[var(--header-height)] w-[calc(100vw-var(--sidebar-width))] left-[var(--sidebar-width)] flex-col justify-between bg-sidebar transition-all duration-75">
      <div className="flex items-center justify-between pr-4 h-full">
        <div className="flex items-center gap-7">
          {/* <NavBarLogo organizationSlug={organizationSlug} projectSlug={projectSlug} /> */}
          {/* <SidebarTrigger className="px-4" /> */}

          {/* <OrganizationSwitcher organizationSlug={organizationSlug} /> */}
          <ProjectSwitcher organizationSlug={organizationSlug} projectSlug={projectSlug} />
        </div>

        <div className="flex items-center justify-center gap-4">
          <FeedbackButton />
          <NavUser />
        </div>
      </div>
    </div>
  );
}
