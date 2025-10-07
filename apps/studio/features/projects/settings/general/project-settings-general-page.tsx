import {
  authenticateWithSession,
  ProjectNotFoundError,
  ProjectService
} from '@voidhash/core/services';
import { Effect, Either } from 'effect';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { headers } from '@/lib/effect/headers';
import { ServerComponent } from '@/lib/nextjs-runtime';
import { ProjectDelete } from './project-delete';
import { ProjectNameForm } from './project-name';
import { ProjectSettingsGeneralLayout } from './project-settings-general-layout';

export const _ProjectSettingsGeneralPage = Effect.fn(
  'ProjectSettingsGeneralPage'
)(function* ({
  organizationSlug,
  projectSlug
}: {
  organizationSlug: string;
  projectSlug: string;
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
          message: 'An error occured loading the project'
        }}
      />
    );
  }

  const { project } = data.right;

  return (
    <ProjectSettingsGeneralLayout>
      <ProjectNameForm key={projectSlug} project={project} />
      <ProjectDelete projectId={project.id} />
    </ProjectSettingsGeneralLayout>
  );
});

export const ProjectSettingsGeneralPage = ServerComponent.build(
  _ProjectSettingsGeneralPage
);
