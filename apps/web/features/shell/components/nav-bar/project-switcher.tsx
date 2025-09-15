import type { Project } from '@voidhash/db';
import { GradientAvatar, Skeleton } from '@voidhash/ui';
import { Effect, Either } from 'effect';
import Link from 'next/link';
import { Suspense } from 'react';
import { NotFoundError } from '@/lib/effect/errors';
import { ServerComponent } from '@/lib/effect/runtimes/nextjs';
import {
  AuthSession,
  authenticateWithSession
} from '@/lib/services/auth.service';
import { OrganizationService } from '@/lib/services/organization.service';
import { ProjectService } from '@/lib/services/project.service';
import { UserService } from '@/lib/services/user.service';
import { NavSlashSeparator } from './nav-slash-separator';
import { OrganizationProjectSwitcher } from './organization-project-switcher';

const ProjectTitle = ({ project }: { project: Project }) => {
  return (
    <div className="flex items-center gap-2">
      <GradientAvatar
        alt={project.name}
        className="h-6 w-6 rounded-lg text-xs"
        fallback={project.id}
        src={undefined}
      />

      <span className="truncate text-foreground- text-sm">{project.name}</span>
    </div>
  );
};

const ProjectTitleSkeleton = () => {
  return (
    <div className="flex items-center gap-2">
      <Skeleton className="h-6 w-6 rounded-full" />
      <Skeleton className="h-4 w-24" />
    </div>
  );
};

export const _ProjectSwitcher = Effect.fn('ProjectSwitcher')(function* ({
  organizationSlug,
  projectSlug
}: {
  organizationSlug: string | null;
  projectSlug: string | null;
}) {
  if (!(projectSlug && organizationSlug)) {
    return null;
  }

  const data = yield* Effect.either(
    authenticateWithSession(
      Effect.gen(function* () {
        const userService = yield* UserService;
        const organizationService = yield* OrganizationService;
        const projectService = yield* ProjectService;
        const [user, activeOrganization, activeProject] = yield* Effect.all(
          [
            userService.getUser(),
            organizationService.getOrganizationBySlug(organizationSlug).pipe(
              Effect.catchTags({
                OrganizationNotFound: () =>
                  Effect.fail(
                    new NotFoundError({
                      message: 'Organization not found'
                    })
                  )
              })
            ),
            projectService.getProjectBySlugAndOrganizationSlug({
              organizationSlug,
              projectSlug
            })
          ],
          {
            concurrency: 'unbounded'
          }
        );

        if (!activeProject) {
          return yield* Effect.fail(
            new NotFoundError({
              message: 'Project not found'
            })
          );
        }
        return { user, activeOrganization, activeProject };
      })
    )
  );

  if (Either.isLeft(data)) {
    return null;
  }

  const { user, activeOrganization, activeProject } = data.right;

  return (
    <>
      <NavSlashSeparator />
      <div className="flex items-center gap-2">
        <Link href={`/${organizationSlug}/${projectSlug}`}>
          <div className="flex items-center gap-2">
            <Suspense fallback={<ProjectTitleSkeleton />}>
              <ProjectTitle project={activeProject} />
            </Suspense>
          </div>
        </Link>
        <OrganizationProjectSwitcher
          activeOrganization={activeOrganization}
          activeProject={activeProject}
          user={user}
        />
      </div>
    </>
  );
});

export const ProjectSwitcher = ServerComponent.build(_ProjectSwitcher);
