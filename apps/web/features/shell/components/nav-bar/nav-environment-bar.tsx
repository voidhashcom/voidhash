import { Environment as EnvironmentEnum } from '@voidhash/lib/index';
import { cn } from '@voidhash/ui';
import { Effect } from 'effect';
import { Suspense } from 'react';
import { NotFoundError } from '@/lib/effect/errors';
import { runServerEffect } from '@/lib/effect/runtimes/nextjs';
import { AuthService, AuthSession } from '@/lib/services/auth.service';
import {
  Environment,
  EnvironmentService
} from '@/lib/services/environment.service';
import { ProjectService } from '@/lib/services/project.service';

export async function EnviromentBarContent({
  organizationSlug,
  projectSlug
}: {
  organizationSlug: string | null;
  projectSlug: string | null;
}) {
  if (!(organizationSlug && projectSlug)) {
    return null;
  }

  const data = await runServerEffect(
    Effect.gen(function* () {
      const authService = yield* AuthService;
      const environmentService = yield* EnvironmentService;
      const authSession = yield* authService.authenticateWithSession();
      return yield* AuthSession.provide(authSession)(
        Effect.gen(function* () {
          const environment =
            yield* environmentService.getEnvironmentFromCookie({
              organizationSlug,
              projectSlug
            });
          return yield* Environment.provide(environment)(
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
          );
        })
      );
    })
  );

  if (data.isErr()) {
    return null;
  }

  const { project, environment } = data.value;

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
