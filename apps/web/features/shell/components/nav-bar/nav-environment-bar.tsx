import {
  authenticateWithSession,
  Environment,
  ProjectNotFoundError,
  ProjectService,
  withEnvironmentFromCookie
} from '@voidhash/core/services';
import { Environment as EnvironmentEnum } from '@voidhash/lib/index';
import { cn } from '@voidhash/ui';
import { Effect, Either } from 'effect';
import { Suspense } from 'react';
import { headers } from '@/lib/effect/headers';
import { ServerComponent } from '@/lib/nextjs-runtime';

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
      authenticateWithSession(yield* headers)(
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
                  new ProjectNotFoundError({
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
