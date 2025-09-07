import {
  and,
  eq,
  type InsertPaymentProviderConfiguration,
  isNull,
  ne,
  paymentProviderConfigurations
} from '@voidhash/db';
import { Effect } from 'effect';
import { Db } from '@/lib/effect/db';

export class PaymentProviderConfigurationRepository extends Effect.Service<PaymentProviderConfigurationRepository>()(
  'PaymentProviderConfigurationRepository',
  {
    effect: Effect.gen(function* () {
      const dbService = yield* Db;
      return {
        createPaymentProviderConfiguration: dbService.makeQuery(
          (execute, configuration: InsertPaymentProviderConfiguration) =>
            execute(
              async (db) =>
                await db
                  .insert(paymentProviderConfigurations)
                  .values(configuration)
            )
        ),

        getPaymentProviderConfigurations: dbService.makeQuery(
          (execute, projectId: string) =>
            execute(
              async (db) =>
                await db.query.paymentProviderConfigurations.findMany({
                  where: and(
                    eq(paymentProviderConfigurations.projectId, projectId),
                    isNull(paymentProviderConfigurations.deletedAt)
                  )
                })
            )
        ),

        getPaymentProviderConfigurationById: dbService.makeQuery(
          (execute, id: string) =>
            execute(
              async (db) =>
                await db.query.paymentProviderConfigurations.findFirst({
                  where: eq(paymentProviderConfigurations.id, id)
                })
            )
        ),

        getExistingPaymentProviderConfigurationByProviderId:
          dbService.makeQuery(
            (
              execute,
              input: {
                projectId: string;
                providerId: string;
              }
            ) =>
              execute(
                async (db) =>
                  await db.query.paymentProviderConfigurations.findFirst({
                    where: and(
                      eq(
                        paymentProviderConfigurations.projectId,
                        input.projectId
                      ),
                      eq(
                        paymentProviderConfigurations.providerId,
                        input.providerId
                      ),
                      isNull(paymentProviderConfigurations.deletedAt)
                    )
                  })
              )
          ),

        updatePaymentProviderConfiguration: dbService.makeQuery(
          (
            execute,
            input: {
              id: string;
              configuration?: Record<string, unknown>;
              enabled?: boolean;
              name?: string;
              paymentProviderKey?: string;
            }
          ) =>
            execute(
              async (db) =>
                await db
                  .update(paymentProviderConfigurations)
                  .set({
                    ...(input.configuration !== undefined && {
                      configuration: input.configuration
                    }),
                    ...(input.enabled !== undefined && {
                      enabled: input.enabled
                    }),
                    ...(input.name !== undefined && { name: input.name }),
                    ...(input.paymentProviderKey !== undefined && {
                      paymentProviderKey: input.paymentProviderKey
                    })
                  })
                  .where(eq(paymentProviderConfigurations.id, input.id))
            )
        ),

        deletePaymentProviderConfiguration: dbService.makeQuery(
          (execute, id: string) =>
            execute(
              async (db) =>
                await db
                  .update(paymentProviderConfigurations)
                  .set({
                    deletedAt: new Date()
                  })
                  .where(eq(paymentProviderConfigurations.id, id))
            )
        ),

        checkPaymentProviderKeyAvailability: dbService.makeQuery(
          (
            execute,
            input: {
              key: string;
              providerId: string;
              projectId: string;
              excludeId?: string;
            }
          ) =>
            execute(async (db) => {
              const conditions = [
                eq(paymentProviderConfigurations.projectId, input.projectId),
                eq(paymentProviderConfigurations.providerId, input.providerId),
                eq(paymentProviderConfigurations.paymentProviderKey, input.key),
                isNull(paymentProviderConfigurations.deletedAt)
              ];

              if (input.excludeId) {
                conditions.push(
                  ne(paymentProviderConfigurations.id, input.excludeId)
                );
              }

              const existingConfigurations = await db
                .select()
                .from(paymentProviderConfigurations)
                .where(and(...conditions));

              return existingConfigurations.length === 0;
            })
        )
      };
    }),

    // Specify dependencies
    dependencies: [Db.Default]
  }
) {}
