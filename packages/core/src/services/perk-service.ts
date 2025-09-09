import { generateId } from '@voidhash/lib';
import { Effect } from 'effect';
import { PerkRepository } from '../repositories/perk-repository';
import { checkProjectPermission } from '../utils/permissions';
import { AuthSession } from './auth-service';
import { Environment } from './environment-service';
import { PerkNotFound, SlugAlreadyExistsError } from './errors';

export class PerkService extends Effect.Service<PerkService>()('PerkService', {
  dependencies: [PerkRepository.Default],
  effect: Effect.gen(function* () {
    const perkRepository = yield* PerkRepository;
    return {
      createPerk: (input: { projectId: string; name: string; slug: string }) =>
        Effect.gen(function* () {
          const session = yield* AuthSession;
          const environment = yield* Environment;
          const perkRepository = yield* PerkRepository;

          // SECURITY: Authorization check
          yield* checkProjectPermission(
            input.projectId,
            'project:all',
            `User ${session?.user?.id} is not authorized to create perks for project ${input.projectId}`
          );

          const perk = yield* perkRepository.getPerkBySlug({
            slug: input.slug,
            projectId: input.projectId,
            environment
          });
          if (perk) {
            return yield* Effect.fail(
              new SlugAlreadyExistsError({
                message:
                  'Perk with this slug already exists. Please choose a different slug.'
              })
            );
          }

          const newPerk = {
            id: generateId('perk'),
            slug: input.slug,
            projectId: input.projectId,
            name: input.name,
            environment
          };

          yield* perkRepository.createPerk(newPerk);
          yield* Effect.log(
            `Created perk ${newPerk.id} for project ${input.projectId}`
          );

          // TODO: Adding a perk should unlock it for existing users?

          return yield* Effect.succeed({
            id: newPerk.id
          });
        }),

      getPerks: (projectId: string) =>
        Effect.gen(function* () {
          const session = yield* AuthSession;
          const environment = yield* Environment;
          // SECURITY: Authorization check
          yield* checkProjectPermission(
            projectId,
            'project:all',
            `User ${session?.user?.id} is not authorized to access perks for project ${projectId}`
          );
          return yield* perkRepository.getPerks({
            projectId,
            environment
          });
        }),

      getPerkById: (id: string) =>
        Effect.gen(function* () {
          const session = yield* AuthSession;
          const perk = yield* perkRepository.getPerkById(id);
          if (!perk) {
            return yield* Effect.fail(
              new PerkNotFound({
                message: 'Perk not found'
              })
            );
          }

          // SECURITY: Authorization check
          yield* checkProjectPermission(
            perk.projectId,
            'project:all',
            `User ${session?.user?.id} is not authorized to access perk ${id} for project ${perk.projectId}`
          );

          return perk;
        }),

      deletePerk: (input: { perkId: string }) =>
        Effect.gen(function* () {
          const session = yield* AuthSession;
          const perkRepository = yield* PerkRepository;
          const perk = yield* perkRepository.getPerkById(input.perkId);
          if (!perk) {
            return yield* Effect.fail(
              new PerkNotFound({
                message: `Perk with id ${input.perkId} not found`
              })
            );
          }

          // SECURITY: Authorization check
          yield* checkProjectPermission(
            perk.projectId,
            'project:all',
            `User ${session?.user?.id} is not authorized to delete perk ${input.perkId}`
          );

          yield* perkRepository.deletePerk(input.perkId);
        })
    };
  })
}) {}
