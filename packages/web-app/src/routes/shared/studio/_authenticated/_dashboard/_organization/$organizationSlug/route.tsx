import { Outlet, createFileRoute } from "@tanstack/react-router";
import { SidebarInset } from "@voidhash/ui";

import { NavBar } from "@/features/studio/shell";
import { OrganizationSidebar } from "@/features/studio/shell/components/sidebar/organization-sidebar";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_organization/$organizationSlug",
)({
  component: OrganizationLayout,
});

function OrganizationLayout() {
  const { organizationSlug } = Route.useParams();

  return (
    <>
      <NavBar organizationSlug={organizationSlug} projectSlug={null} />
      <div className="flex flex-1 pt-[var(--header-height)] min-h-0">
        <OrganizationSidebar organizationSlug={organizationSlug} />

        <SidebarInset className="transition-all duration-75 mt-0!">
          <Outlet />
        </SidebarInset>
      </div>
    </>
  );
}
