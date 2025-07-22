import { Effect } from 'effect';
import { Page } from '@/features/shell';
import { NotFoundError } from '@/lib/effect/errors';
import { runServerEffect } from '@/lib/effect/runtimes/nextjs';
import { AuthService, AuthSession } from '@/lib/services/auth.service';
import { ProjectService } from '@/lib/services/project.service';
import { VoidhashErrorCard } from '../shell/components/voidhash-error-card';
export async function DevelopersPage({
  organizationSlug,
  projectSlug
}: {
  organizationSlug: string;
  projectSlug;
}) {
  const data = await runServerEffect(
    Effect.gen(function* () {
      const authService = yield* AuthService;
      const authSession = yield* authService.authenticateWithSession();
      return yield* AuthSession.provide(authSession)(
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
      );
    })
  );

  if (data.isErr()) {
    const error = data._unsafeUnwrapErr();
    return <VoidhashErrorCard error={error} />;
  }

  // const {} = data.value;

  return (
    <Page>
      <div className="mx-auto max-w-4xl">
        <h1 className="font-normal text-3xl tracking-right">Developers</h1>
      </div>
    </Page>
  );
}
