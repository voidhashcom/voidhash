import { Outlet, createFileRoute, useLocation } from "@tanstack/react-router";
import { SidebarInset, useSidebar } from "@voidhash/ui";
import { useEffect } from "react";

import { NavBar } from "@/features/shell";
import { ProjectSettingsSidebar } from "@/features/shell/project-settings-sidebar";
import { ProjectSidebar } from "@/features/shell/project-sidebar";

export const Route = createFileRoute(
  "/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug"
)({
  component: ProjectLayout,
});

export function LayoutSidebar({
  projectSidebar,
  projectSettingsSidebar,
}: {
  projectSidebar: React.ReactNode;
  projectSettingsSidebar: React.ReactNode;
}) {
  const pathname = useLocation({
    select: (location) => location.pathname,
  });
  const isSettingsRoute = pathname.includes("/settings");

  const { setOpen } = useSidebar();
  useEffect(() => {
    if (isSettingsRoute) {
      setOpen(false);
    } else if (!isSettingsRoute) {
      setOpen(true);
    }
  }, [isSettingsRoute, setOpen]);

  return (
    <div className="flex flex-row">
      {projectSidebar}
      {isSettingsRoute && projectSettingsSidebar}
    </div>
  );
}

function ProjectLayout() {
  const { organizationSlug, projectSlug } = Route.useParams();

  return (
    <>
      <NavBar organizationSlug={organizationSlug} projectSlug={projectSlug} />

      <div className="flex flex-1">
        <LayoutSidebar
          projectSettingsSidebar={
            <ProjectSettingsSidebar
              organizationSlug={organizationSlug}
              projectSlug={projectSlug}
            />
          }
          projectSidebar={
            <ProjectSidebar
              organizationSlug={organizationSlug}
              projectSlug={projectSlug}
            />
          }
        />
        <SidebarInset className="top-[var(--header-height)] transition-all duration-75">
          <Outlet />
        </SidebarInset>
      </div>
    </>
  );
}
