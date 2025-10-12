import {
  authenticateWithSession,
  ProjectNotFoundError,
  ProjectService
} from '@voidhash/core/services';
import { Effect, Either } from 'effect';
import { Page } from '@/features/shell';
import { headers } from '@/lib/effect/headers';
import { ServerComponent } from '@/lib/nextjs-runtime';
import { VoidhashErrorCard } from '../shell/components/voidhash-error-card';
export const _DevelopersPage = Effect.fn('DevelopersPage')(function* ({
  organizationSlug,
  projectSlug
}: {
  organizationSlug: string;
  projectSlug;
}) {
  const data = yield* Effect.either(
    authenticateWithSession(yield* headers)(
      Effect.gen(function* () {
        const projectService = yield* ProjectService;
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
        return { project };
      })
    )
  );

  if (Either.isLeft(data)) {
    return (
      <VoidhashErrorCard
        error={{
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occured loading the developers'
        }}
      />
    );
  }

  return (
    <Page>
      <div className="mx-auto max-w-4xl">
        <h1 className="font-normal text-3xl tracking-right">Developers</h1>
      </div>
    </Page>
  );
});

export const DevelopersPage = ServerComponent.build(_DevelopersPage);
