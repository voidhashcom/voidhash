import { Environment as EnvironmentEnum } from '@voidhash/lib/index';
import { Effect, Either } from 'effect';
import { Suspense } from 'react';
import { NotFoundError } from '@/lib/effect/errors';
import {
  HandleCommonErrors,
  ServerComponent
} from '@/lib/effect/runtimes/nextjs';
import { authenticateWithSession } from '@/lib/services/auth.service';
import {
  Environment,
  withEnvironmentFromCookie
} from '@/lib/services/environment.service';
import { ProjectService } from '@/lib/services/project.service';
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
    authenticateWithSession(
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
              new NotFoundError({
                message: 'Project not found'
              })
            );
          }
          return { project, environment };
        })
      )
    ).pipe(HandleCommonErrors)
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
