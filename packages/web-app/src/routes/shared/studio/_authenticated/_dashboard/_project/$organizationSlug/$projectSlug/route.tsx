import { Outlet, createFileRoute } from "@tanstack/react-router";
import { SidebarInset } from "@voidhash/ui";

import { NavBar } from "@/features/studio/shell";
import { ProjectSidebar } from "@/features/studio/shell/components/sidebar/project-sidebar";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug",
)({
  component: ProjectLayout,
});

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
