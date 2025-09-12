import { Card } from '@voidhash/ui';
import { Effect, Either } from 'effect';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { NotFoundError } from '@/lib/effect/errors';
import {
  encodeNextjsErrorResponse,
  HandleCommonErrors,
  ServerComponent
} from '@/lib/effect/runtimes/nextjs';
import { AuthService, AuthSession } from '@/lib/services/auth.service';
import {
  Environment,
  EnvironmentService
} from '@/lib/services/environment.service';
import { PerkService } from '@/lib/services/perk.service';
import { ProjectService } from '@/lib/services/project.service';
import { CreatePerkModalButton } from './create-perk-modal-button';
import { PerkRecord } from './perk-record';
import { PerksPageEmptyState } from './perks-page-empty-state';

export const _PerksPage = Effect.fn('PerksPage')(function* ({
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
              const perkService = yield* PerkService;
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
              const perks = yield* perkService.getPerks(project.id);
              return { project, perks };
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

  const { project, perks } = data.right;

  return (
    <div>
      <div className="flex flex-row items-center justify-between pt-6">
        <div>
          <h2 className="font-normal text-xl tracking-right">Perks</h2>
          <p className="mt-1 text-muted-foreground">
            List of unlockable features / perks.
          </p>
        </div>
        {perks.length > 0 && <CreatePerkModalButton projectId={project.id} />}
      </div>

      <div className="mt-8">
        {perks.length === 0 ? (
          <PerksPageEmptyState projectId={project.id} />
        ) : (
          <Card className="grid gap-0 divide-y p-0">
            {perks.map((perk) => (
              <PerkRecord key={perk.id} perk={perk} />
            ))}
          </Card>
        )}
      </div>
    </div>
  );
});

export const PerksPage = ServerComponent.build(_PerksPage);
