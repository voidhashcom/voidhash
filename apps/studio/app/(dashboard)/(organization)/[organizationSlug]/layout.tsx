import { SidebarInset } from '@voidhash/ui';
import { NavBar } from '@/features/shell';
import { OrganizationSettingsSidebar } from '@/features/shell/organization-settings-sidebar';
import { OrganizationSidebar } from '@/features/shell/organization-sidebar';
import { LayoutSidebar } from './layout-sidebar';

export default async function OrganizationLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;

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
          {children}
        </SidebarInset>
      </div>
    </>
  );
}
