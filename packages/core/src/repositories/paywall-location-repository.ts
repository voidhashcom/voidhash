import {
  and,
  eq,
  type InsertPaywallLocation,
  paywallLocations
} from '@voidhash/db';
import { Db } from '@voidhash/db/effect';
import type { EnvironmentValue } from '@voidhash/lib/constants';
import { Effect } from 'effect';

export class PaywallLocationRepository extends Effect.Service<PaywallLocationRepository>()(
  'PaywallLocationRepository',
  {
    effect: Effect.gen(function* () {
      const dbService = yield* Db;
      return {
        createPaywallLocation: dbService.makeQuery(
          (execute, paywallLocation: InsertPaywallLocation) =>
            execute(
              async (db) =>
                await db.insert(paywallLocations).values(paywallLocation)
            )
        ),

        getPaywallLocations: dbService.makeQuery(
          (
            execute,
            input: { projectId: string; environment: EnvironmentValue }
          ) =>
            execute(
              async (db) =>
                await db.query.paywallLocations.findMany({
                  where: and(
                    eq(paywallLocations.projectId, input.projectId),
                    eq(paywallLocations.environment, input.environment)
                  )
                })
            )
        ),

        getPaywallLocationById: dbService.makeQuery((execute, id: string) =>
          execute(
            async (db) =>
              await db.query.paywallLocations.findFirst({
                where: eq(paywallLocations.id, id)
              })
          )
        ),

        getPaywallLocationBySlug: dbService.makeQuery(
          (
            execute,
            input: {
              slug: string;
              projectId: string;
              environment: EnvironmentValue;
            }
          ) =>
            execute(
              async (db) =>
                await db.query.paywallLocations.findFirst({
                  where: and(
                    eq(paywallLocations.slug, input.slug),
                    eq(paywallLocations.projectId, input.projectId),
                    eq(paywallLocations.environment, input.environment)
                  )
                })
            )
        ),

        deletePaywallLocation: dbService.makeQuery((execute, id: string) =>
          execute(async (db) =>
            db.delete(paywallLocations).where(eq(paywallLocations.id, id))
          )
        )
      };
    }),

    // Specify dependencies
    dependencies: [Db.Default]
  }
) {}
