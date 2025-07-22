import { SidebarInset } from '@voidhash/ui';
import { Effect } from 'effect';
import { Suspense } from 'react';
import { NavBar } from '@/features/shell';
import { OrganizationSettingsSidebar } from '@/features/shell/organization-settings-sidebar';
import { OrganizationSidebar } from '@/features/shell/organization-sidebar';
import { runServerEffect } from '@/lib/effect/runtimes/nextjs';
import { AuthService, AuthSession } from '@/lib/services/auth.service';
import { ProjectService } from '@/lib/services/project.service';
import { LayoutSidebar } from './layout-sidebar';

async function OrganizationSettingsLayoutSidebar({
  organizationSlug
}: {
  organizationSlug: string;
}) {
  const data = await runServerEffect(
    Effect.gen(function* () {
      const authService = yield* AuthService;
      const authSession = yield* authService.authenticateWithSession();
      return yield* AuthSession.provide(authSession)(
        Effect.gen(function* () {
          const projectService = yield* ProjectService;
          const projects =
            yield* projectService.getProjectsByOrganizationSlug(
              organizationSlug
            );
          return { projects };
        })
      );
    })
  );

  if (data.isErr()) {
    return null;
  }

  const { projects } = data.value;

  return (
    <OrganizationSettingsSidebar
      areProjectsLoading={false}
      projects={projects ?? []}
    />
  );
}

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
          organizationSettingsSidebar={
            <Suspense
              fallback={
                <OrganizationSettingsSidebar
                  areProjectsLoading={true}
                  projects={[]}
                />
              }
            >
              <OrganizationSettingsLayoutSidebar
                organizationSlug={organizationSlug}
              />
            </Suspense>
          }
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
