import {
  authenticateWithSession,
  PerkService,
  ProjectNotFoundError,
  ProjectService,
  withEnvironmentFromCookie
} from '@voidhash/core/services';
import { Card } from '@voidhash/ui';
import { Effect, Either } from 'effect';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { headers } from '@/lib/effect/headers';
import { ServerComponent } from '@/lib/nextjs-runtime';
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
    authenticateWithSession(yield* headers)(
      withEnvironmentFromCookie({ organizationSlug, projectSlug })(
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
              new ProjectNotFoundError({
                message: 'Project not found'
              })
            );
          }
          const perks = yield* perkService.getPerks(project.id);
          return { project, perks };
        })
      )
    )
  );

  if (Either.isLeft(data)) {
    return (
      <VoidhashErrorCard
        error={{
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occured loading the perks'
        }}
      />
    );
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
