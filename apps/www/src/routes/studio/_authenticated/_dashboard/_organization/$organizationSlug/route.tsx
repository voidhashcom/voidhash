import { Outlet, createFileRoute, useLocation } from "@tanstack/react-router";
import { SidebarInset, useSidebar } from "@voidhash/ui";
import { useEffect } from "react";

import { NavBar } from "@/features/studio/shell";
import { OrganizationSidebar } from "@/features/studio/shell/components/sidebar/organization-sidebar";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_organization/$organizationSlug",
)({
  component: OrganizationLayout,
});

function LayoutSidebar({
  organizationSidebar,
  organizationSettingsSidebar,
}: {
  organizationSidebar: React.ReactNode;
  organizationSettingsSidebar: React.ReactNode;
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
      {organizationSidebar}
      {isSettingsRoute && organizationSettingsSidebar}
    </div>
  );
}

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
