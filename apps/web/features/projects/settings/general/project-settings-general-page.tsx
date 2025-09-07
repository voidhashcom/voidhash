import { Effect } from 'effect';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { NotFoundError } from '@/lib/effect/errors';
import { runServerEffect } from '@/lib/effect/runtimes/nextjs';
import { AuthService, AuthSession } from '@/lib/services/auth.service';
import { ProjectService } from '@/lib/services/project.service';
import { ProjectDelete } from './project-delete';
import { ProjectNameForm } from './project-name';
import { ProjectSettingsGeneralLayout } from './project-settings-general-layout';

export async function ProjectSettingsGeneralPage({
  organizationSlug,
  projectSlug
}: {
  organizationSlug: string;
  projectSlug: string;
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

  const { project } = data.value;

  return (
    <ProjectSettingsGeneralLayout>
      <ProjectNameForm key={projectSlug} project={project} />
      <ProjectDelete projectId={project.id} />
    </ProjectSettingsGeneralLayout>
  );
}
