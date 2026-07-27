import { Outlet, createFileRoute, useLocation } from "@tanstack/react-router";
import { SidebarInset, useSidebar } from "@voidhash/ui";
import { useEffect } from "react";

import { NavBar } from "@/features/studio/shell";
import { ProjectSidebar } from "@/features/studio/shell/components/sidebar/project-sidebar";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug",
)({
  component: ProjectLayout,
});

function LayoutSidebar({
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
      <div className="flex flex-1 pt-[var(--header-height)] min-h-0">
        <ProjectSidebar organizationSlug={organizationSlug} projectSlug={projectSlug} />

        <SidebarInset className="transition-all duration-75 mt-0!">
          <Outlet />
        </SidebarInset>
      </div>
    </>
  );
}
