import { Effect, Either } from 'effect';
import { Page } from '@/features/shell';
import { NotFoundError } from '@/lib/effect/errors';
import {
  encodeNextjsErrorResponse,
  HandleCommonErrors,
  ServerComponent
} from '@/lib/effect/runtimes/nextjs';
import { authenticateWithSession } from '@/lib/services/auth.service';
import { ProjectService } from '@/lib/services/project.service';
import { VoidhashErrorCard } from '../shell/components/voidhash-error-card';
export const _DevelopersPage = Effect.fn('DevelopersPage')(function* ({
  organizationSlug,
  projectSlug
}: {
  organizationSlug: string;
  projectSlug;
}) {
  const data = yield* Effect.either(
    authenticateWithSession(
      Effect.gen(function* () {
        const projectService = yield* ProjectService;
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
        return { project };
      })
    ).pipe(HandleCommonErrors)
  );

  if (Either.isLeft(data)) {
    const error = data.left;
    return <VoidhashErrorCard error={encodeNextjsErrorResponse(error)} />;
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
