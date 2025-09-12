import { Card } from '@voidhash/ui';
import { Effect, Either } from 'effect';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { NotFoundError } from '@/lib/effect/errors';
import {
  encodeNextjsErrorResponse,
  HandleCommonErrors,
  Page
} from '@/lib/effect/runtimes/nextjs';
import { ApiKeyService } from '@/lib/services/api-key.service';
import { AuthService, AuthSession } from '@/lib/services/auth.service';
import {
  Environment,
  EnvironmentService
} from '@/lib/services/environment.service';
import { ProjectService } from '@/lib/services/project.service';
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
    Effect.gen(function* () {
      const authService = yield* AuthService;
      const environmentService = yield* EnvironmentService;
      const apiKeyService = yield* ApiKeyService;
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
              const apiKeys = yield* apiKeyService.getApiKeys(project.id);

              return { project, apiKeys };
            })
          );
        })
      );
    }).pipe(HandleCommonErrors)
  );

  if (Either.isLeft(data)) {
    const error = data.left;
    return <VoidhashErrorCard error={encodeNextjsErrorResponse(error)} />;
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
