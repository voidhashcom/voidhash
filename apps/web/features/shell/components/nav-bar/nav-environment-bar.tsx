import { Environment as EnvironmentEnum } from '@voidhash/lib/index';
import { cn } from '@voidhash/ui';
import { Effect, Either } from 'effect';
import { Suspense } from 'react';
import { NotFoundError } from '@/lib/effect/errors';
import { ServerComponent } from '@/lib/effect/runtimes/nextjs';
import { authenticateWithSession } from '@/lib/services/auth.service';
import {
  Environment,
  withEnvironmentFromCookie
} from '@/lib/services/environment.service';
import { ProjectService } from '@/lib/services/project.service';

export const _EnviromentBarContent = Effect.fn('EnviromentBarContent')(
  function* ({
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
            return yield* Effect.gen(function* () {
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
            });
          })
        )
      )
    );

    if (Either.isLeft(data)) {
      return null;
    }

    const { project, environment } = data.right;

    const showBar =
      project && environment && environment === EnvironmentEnum.Testing;

    return (
      <div
        className={cn(
          'flex w-full flex-1 flex-shrink-0 items-center justify-center bg-primary text-center font-semibold text-sm text-white transition-all duration-75',
          showBar ? 'h-[41px] opacity-100' : 'h-0 opacity-0'
        )}
      >
        {
          // Marker to update layout if bar is visible
          showBar && <div className="display-none" id="nav-enviromental-bar" />
        }
        You are in development mode. Displaying test data.
      </div>
    );
  }
);

export const EnviromentBarContent = ServerComponent.build(
  _EnviromentBarContent
);

export function EnviromentBar({
  organizationSlug,
  projectSlug
}: {
  organizationSlug: string | null;
  projectSlug: string | null;
}) {
  return (
    <Suspense fallback={<div />}>
      <EnviromentBarContent
        organizationSlug={organizationSlug}
        projectSlug={projectSlug}
      />
    </Suspense>
  );
}
