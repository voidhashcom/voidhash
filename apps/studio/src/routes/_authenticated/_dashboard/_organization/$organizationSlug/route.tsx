import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router';
import { SidebarInset, useSidebar } from '@voidhash/ui';
import { useEffect } from 'react';
import { NavBar } from '@/features/shell';
import { OrganizationSettingsSidebar } from '@/features/shell/organization-settings-sidebar';
import { OrganizationSidebar } from '@/features/shell/organization-sidebar';

export const Route = createFileRoute(
  '/_authenticated/_dashboard/_organization/$organizationSlug'
)({
  component: OrganizationLayout
});

export function LayoutSidebar({
  organizationSidebar,
  organizationSettingsSidebar
}: {
  organizationSidebar: React.ReactNode;
  organizationSettingsSidebar: React.ReactNode;
}) {
  const pathname = useLocation({
    select: (location) => location.pathname
  });
  const isSettingsRoute = pathname.includes('/settings');

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
      <div className="flex flex-1">
        <LayoutSidebar
          organizationSettingsSidebar={<OrganizationSettingsSidebar />}
          organizationSidebar={
            <OrganizationSidebar organizationSlug={organizationSlug} />
          }
        />
        <SidebarInset className="top-[var(--header-height)] transition-all duration-75">
          <Outlet />
        </SidebarInset>
      </div>
    </>
  );
}
