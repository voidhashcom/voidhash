import { and, eq, type InsertPerk, perks } from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import { generateId } from '@voidhash/lib';
import {
  AuthSession,
  PerkNotFoundError,
  PerkServiceError,
  PerkSlugAlreadyExistsError
} from '@voidhash/shared';
import { Effect, pipe } from 'effect';
import { checkProjectPermission } from '../utils/permissions';

export class PerkService extends Effect.Service<PerkService>()('PerkService', {
  dependencies: [Db.Default],
  effect: Effect.gen(function* () {
    const dbService = yield* Db;

    const _getPerkBySlug = dbService.makeQuery(
      (
        execute,
        input: {
          slug: string;
          projectId: string;
        }
      ) =>
        execute(
          async (db) =>
            await db.query.perks.findFirst({
              where: and(
                eq(perks.slug, input.slug),
                eq(perks.projectId, input.projectId)
              )
            })
        )
    );

    const _createPerkRecord = dbService.makeQuery((execute, perk: InsertPerk) =>
      execute(async (db) => await db.insert(perks).values(perk))
    );

    const createPerk = (input: {
      projectId: string;
      name: string;
      slug: string;
    }) =>
      pipe(
        Effect.gen(function* () {
          const session = yield* AuthSession;

          // SECURITY: Authorization check
          yield* checkProjectPermission(
            input.projectId,
            'project:all',
            `User ${session?.user?.id} is not authorized to create perks for project ${input.projectId}`
          );

          const perk = yield* _getPerkBySlug({
            slug: input.slug,
            projectId: input.projectId
          });
          if (perk) {
            return yield* Effect.fail(
              new PerkSlugAlreadyExistsError({
                slug: input.slug
              })
            );
          }

          const newPerk = {
            id: generateId('perk'),
            slug: input.slug,
            projectId: input.projectId,
            name: input.name
          };

          yield* _createPerkRecord(newPerk);
          yield* Effect.log(
            `Created perk ${newPerk.id} for project ${input.projectId}`
          );

          // TODO: Adding a perk should unlock it for existing users?

          return {
            id: newPerk.id
          };
        }),
        Effect.catchTags({
          DatabaseError: (error) =>
            new PerkServiceError({
              cause: String(error.cause)
            })
        })
      );

    const _getPerksByProjectId = dbService.makeQuery(
      (execute, input: { projectId: string }) =>
        execute(
          async (db) =>
            await db.query.perks.findMany({
              where: and(eq(perks.projectId, input.projectId))
            })
        )
    );

    const getPerks = (projectId: string) =>
      pipe(
        Effect.gen(function* () {
          const session = yield* AuthSession;
          // SECURITY: Authorization check
          yield* checkProjectPermission(
            projectId,
            'project:all',
            `User ${session?.user?.id} is not authorized to access perks for project ${projectId}`
          );
          return yield* _getPerksByProjectId({
            projectId
          });
        }),
        Effect.catchTags({
          DatabaseError: (error) =>
            new PerkServiceError({
              cause: String(error.cause)
            })
        })
      );

    const _getPerkById = dbService.makeQuery((execute, id: string) =>
      execute(
        async (db) =>
          await db.query.perks.findFirst({ where: eq(perks.id, id) })
      )
    );

    const getPerkById = (id: string) =>
      pipe(
        Effect.gen(function* () {
          const session = yield* AuthSession;
          const perk = yield* _getPerkById(id);
          if (!perk) {
            return yield* Effect.fail(
              new PerkNotFoundError({
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
        Effect.catchTags({
          DatabaseError: (error) =>
            new PerkServiceError({
              cause: String(error.cause)
            })
        })
      );

    const _deletePerkRecord = dbService.makeQuery((execute, id: string) =>
      execute(async (db) => db.delete(perks).where(eq(perks.id, id)))
    );

    const deletePerk = (input: { perkId: string }) =>
      pipe(
        Effect.gen(function* () {
          const session = yield* AuthSession;
          const perk = yield* _getPerkById(input.perkId);
          if (!perk) {
            return yield* Effect.fail(
              new PerkNotFoundError({
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

          yield* _deletePerkRecord(input.perkId);
          yield* Effect.log(`Deleted perk ${input.perkId}`);
        }),
        Effect.catchTags({
          DatabaseError: (error) =>
            new PerkServiceError({
              cause: String(error.cause)
            })
        })
      );

    return {
      createPerk,
      getPerks,
      getPerkById,
      deletePerk
    } as const;
  })
}) {}
