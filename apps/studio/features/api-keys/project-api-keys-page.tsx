import {
  ApiKeyService,
  authenticateWithSession,
  ProjectNotFoundError,
  ProjectService,
  withEnvironmentFromCookie
} from '@voidhash/core/services';
import { Card } from '@voidhash/ui';
import { Effect, Either } from 'effect';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { headers } from '@/lib/effect/headers';
import { Page } from '@/lib/nextjs-runtime';
import { ApiKeyRecord } from './api-key-record';
import { CreateSecretKeyModalButton } from './create-secret-key-modal-button';

const _ProjectApiKeysPage = Effect.fn('ProjectApiKeysPage')(function* ({
  organizationSlug,
  projectSlug
}: {
  organizationSlug: string;
  projectSlug: string;
}) {
  const data = yield* Effect.either(
    authenticateWithSession(yield* headers)(
      withEnvironmentFromCookie({ organizationSlug, projectSlug })(
        Effect.gen(function* () {
          const apiKeyService = yield* ApiKeyService;
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
          const apiKeys = yield* apiKeyService.getApiKeys(project.id);
          return { project, apiKeys };
        })
      )
    )
  );

  if (Either.isLeft(data)) {
    return (
      <VoidhashErrorCard
        error={{
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occured loading the api keys'
        }}
      />
    );
  }

  const { project, apiKeys } = data.right;

  return (
    <div>
      <div className="flex flex-row items-center justify-between pt-6">
        <div>
          <h2 className="font-normal text-xl tracking-right">API Keys</h2>
          <p className="mt-1 text-muted-foreground">Manage your API keys</p>
        </div>
        <CreateSecretKeyModalButton projectId={project.id} />
      </div>

      <div className="mt-8">
        <Card className="grid gap-0 divide-y p-0">
          {apiKeys.map((apiKey) => (
            <ApiKeyRecord apiKey={apiKey} key={apiKey.id} />
          ))}
        </Card>
      </div>
    </div>
  );
});

export const ProjectApiKeysPage = Page.build(_ProjectApiKeysPage);
