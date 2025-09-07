import { SidebarInset } from '@voidhash/ui';
import { Effect } from 'effect';
import { Suspense } from 'react';
import { NavBar } from '@/features/shell';
import { ProjectSettingsSidebar } from '@/features/shell/project-settings-sidebar';
import { ProjectSidebar } from '@/features/shell/project-sidebar';
import { runServerEffect } from '@/lib/effect/runtimes/nextjs';
import { AuthService, AuthSession } from '@/lib/services/auth.service';
import { OrganizationService } from '@/lib/services/organization.service';
import { LayoutSidebar } from './layout-sidebar';

async function ProjectLayoutSidebar({
  organizationSlug,
  projectSlug
}: {
  organizationSlug: string;
  projectSlug: string;
}) {
  const data = await runServerEffect(
    Effect.gen(function* () {
      const authService = yield* AuthService;
      const authSession = yield* authService.authenticateWithSession();
      return yield* AuthSession.provide(authSession)(
        Effect.gen(function* () {
          const organizationService = yield* OrganizationService;
          const activeOrganizationRes = yield* organizationService
            .getOrganizationBySlug(organizationSlug)
            .pipe(
              Effect.catchTags({
                OrganizationNotFound: () => Effect.succeed(null)
              })
            );
          return { activeOrganization: activeOrganizationRes };
        })
      );
    })
  );

  if (data.isErr()) {
    return null;
  }

  const { activeOrganization } = data.value;

  return (
    <ProjectSettingsSidebar
      activeOrganization={activeOrganization}
      isActiveOrganizationLoading={false}
      organizationSlug={organizationSlug}
      projectSlug={projectSlug}
    />
  );
}

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
            <Suspense
              fallback={
                <ProjectSettingsSidebar
                  activeOrganization={null}
                  isActiveOrganizationLoading={true}
                  organizationSlug={organizationSlug}
                  projectSlug={projectSlug}
                />
              }
            >
              <ProjectLayoutSidebar
                organizationSlug={organizationSlug}
                projectSlug={projectSlug}
              />
            </Suspense>
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
