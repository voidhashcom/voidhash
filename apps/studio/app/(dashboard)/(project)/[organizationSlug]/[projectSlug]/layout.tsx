import { SidebarInset } from '@voidhash/ui';
import { NavBar } from '@/features/shell';
import { ProjectSettingsSidebar } from '@/features/shell/project-settings-sidebar';
import { ProjectSidebar } from '@/features/shell/project-sidebar';
import { LayoutSidebar } from './layout-sidebar';

export default async function ProjectLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ organizationSlug: string; projectSlug: string }>;
}) {
  const { organizationSlug, projectSlug } = await params;

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
          {children}
        </SidebarInset>
      </div>
    </>
  );
}
