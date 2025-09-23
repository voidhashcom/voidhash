import {
  authenticateWithSession,
  OrganizationService
} from '@voidhash/core/services';
import { SidebarInset } from '@voidhash/ui';
import { Effect, Either } from 'effect';
import { Suspense } from 'react';
import { NavBar } from '@/features/shell';
import { ProjectSettingsSidebar } from '@/features/shell/project-settings-sidebar';
import { ProjectSidebar } from '@/features/shell/project-sidebar';
import { headers } from '@/lib/effect/headers';
import { ServerComponent } from '@/lib/nextjs-runtime';
import { LayoutSidebar } from './layout-sidebar';

const _ProjectLayoutSidebar = Effect.fn('ProjectLayoutSidebar')(function* ({
  organizationSlug,
  projectSlug
}: {
  organizationSlug: string;
  projectSlug: string;
}) {
  const data = yield* Effect.either(
    authenticateWithSession(yield* headers)(
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
    )
  );

  if (Either.isLeft(data)) {
    return null;
  }

  const { activeOrganization } = data.right;

  return (
    <ProjectSettingsSidebar
      activeOrganization={activeOrganization}
      isActiveOrganizationLoading={false}
      organizationSlug={organizationSlug}
      projectSlug={projectSlug}
    />
  );
});

export const ProjectLayoutSidebar = ServerComponent.build(
  _ProjectLayoutSidebar
);

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
