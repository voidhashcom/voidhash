import {
  authenticateWithSession,
  Environment,
  ProjectNotFoundError,
  ProjectService,
  withEnvironmentFromCookie
} from '@voidhash/core/services';
import { Environment as EnvironmentEnum } from '@voidhash/lib/index';
import { Effect, Either } from 'effect';
import { Suspense } from 'react';
import { headers } from '@/lib/effect/headers';
import { ServerComponent } from '@/lib/nextjs-runtime';
import { NavProjectEnvironmentToggle } from './nav-project-environment-toggle';

export const _NavProjectEnvironmentContent = Effect.fn(
  'NavProjectEnvironmentContent'
)(function* ({
  organizationSlug,
  projectSlug
}: {
  organizationSlug: string | null;
  projectSlug: string | null;
}) {
  if (!(organizationSlug && projectSlug)) {
    return null;
  }
  const data = yield* Effect.either(
    authenticateWithSession(yield* headers)(
      withEnvironmentFromCookie({ organizationSlug, projectSlug })(
        Effect.gen(function* () {
          const projectService = yield* ProjectService;
          const environment = yield* Environment;
          const project =
            yield* projectService.getProjectBySlugAndOrganizationSlug({
              organizationSlug,
              projectSlug
            });
          if (!project) {
            return yield* Effect.fail(
              new ProjectNotFoundError({
                message: 'Project not found'
              })
            );
          }
          return { project, environment };
        })
      )
    )
  );

  if (Either.isLeft(data)) {
    return null;
  }

  const { project, environment } = data.right;

  return (
    <div>
      <NavProjectEnvironmentToggle
        environment={environment ?? EnvironmentEnum.Testing}
        projectId={project.id}
      />
    </div>
  );
});

export const NavProjectEnvironmentContent = ServerComponent.build(
  _NavProjectEnvironmentContent
);

export function NavProjectEnvironment({
  organizationSlug,
  projectSlug
}: {
  organizationSlug: string | null;
  projectSlug: string | null;
}) {
  return (
    <Suspense fallback={<div />}>
      <NavProjectEnvironmentContent
        organizationSlug={organizationSlug}
        projectSlug={projectSlug}
      />
    </Suspense>
  );
}
