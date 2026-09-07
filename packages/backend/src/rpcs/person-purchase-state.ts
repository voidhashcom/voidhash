import { checkProjectPermission } from "@voidhash/core/utils/permissions";
import { RequestEnvironmentMode } from "@voidhash/core-v2";
import {
  Db,
  eq,
  paymentProviderConfigurationProducts,
  paymentProviderConfigurations,
} from "@voidhash/db";
import {
  type PersonPurchaseState,
  RpcActionForbiddenError,
  RpcPersonNotFoundError,
  RpcPersonServiceError,
} from "@voidhash/rpc";
import * as Effect from "effect/Effect";
import { MutableMap } from "../collection-boundary.ts";

/** Reads purchase history and grants after checking project access and person ownership. */
export const getPersonPurchaseState = Effect.fn("person.getPurchaseState")(
  function* (input: { readonly projectId: string; readonly personId: string }) {
    yield* checkProjectPermission(
      input.projectId,
      "project:all",
      "Not authorized to inspect this person's purchases",
    );
    const db = yield* Db;
    const person = yield* db.query.persons.findFirst({
      where: { id: input.personId, projectId: input.projectId },
    });
    if (!person) return yield* Effect.fail(new RpcPersonNotFoundError({ id: input.personId }));
    const { providerEnvironments } = yield* RequestEnvironmentMode;
    const [subscriptions, purchases, grants, products, perks, mappings] = yield* Effect.all(
      [
        db.query.subscriptions.findMany({
          columns: {
            id: true,
            paymentProviderConfigurationProductId: true,
            providerEnvironment: true,
            startsAt: true,
            expiresAt: true,
            gracePeriodExpiresAt: true,
            status: true,
            cancelAtPeriodEnd: true,
          },
          where: {
            personId: input.personId,
            providerEnvironment: { in: [...providerEnvironments] },
          },
          orderBy: { startsAt: "desc" },
        }),
        db.query.purchases.findMany({
          columns: {
            id: true,
            paymentProviderConfigurationProductId: true,
            providerEnvironment: true,
            createdAt: true,
            refundedAt: true,
            revokedAt: true,
          },
          where: {
            personId: input.personId,
            providerEnvironment: { in: [...providerEnvironments] },
          },
          orderBy: { createdAt: "desc" },
        }),
        db.query.personUnlockedPerks.findMany({
          where: { personId: input.personId, environment: { in: [...providerEnvironments] } },
          orderBy: { createdAt: "desc" },
        }),
        db.query.products.findMany({ where: { projectId: input.projectId } }),
        db.query.perks.findMany({ where: { projectId: input.projectId } }),
        db
          .select({
            id: paymentProviderConfigurationProducts.id,
            productId: paymentProviderConfigurationProducts.productId,
          })
          .from(paymentProviderConfigurationProducts)
          .innerJoin(
            paymentProviderConfigurations,
            eq(
              paymentProviderConfigurationProducts.paymentProviderConfigurationId,
              paymentProviderConfigurations.id,
            ),
          )
          .where(eq(paymentProviderConfigurations.projectId, input.projectId)),
      ],
      { concurrency: 1 },
    );
    const productById = new MutableMap(products.map((product) => [product.id, product.name]));
    const productByMapping = new MutableMap(
      mappings.map((mapping) => [mapping.id, productById.get(mapping.productId)]),
    );
    const perkById = new MutableMap(perks.map((perk) => [perk.id, perk.name]));
    return {
      subscriptions: subscriptions.map((row) => ({
        id: row.id,
        productName:
          productByMapping.get(row.paymentProviderConfigurationProductId) ?? "Unknown product",
        environment: row.providerEnvironment,
        startsAt: row.startsAt,
        expiresAt: row.expiresAt,
        gracePeriodExpiresAt: row.gracePeriodExpiresAt,
        status: row.status,
        willCancelAtPeriodEnd: row.cancelAtPeriodEnd,
      })),
      purchases: purchases.map((row) => ({
        id: row.id,
        productName:
          productByMapping.get(row.paymentProviderConfigurationProductId) ?? "Unknown product",
        environment: row.providerEnvironment,
        createdAt: row.createdAt,
        refundedAt: row.refundedAt,
        revokedAt: row.revokedAt,
      })),
      grants: grants.map((row) => ({
        id: row.id,
        perkName: perkById.get(row.perkId) ?? "Unknown perk",
        environment: row.environment,
        expiresAt: row.expiresAt,
        status: row.status,
      })),
    } satisfies PersonPurchaseState;
  },
  Effect.catchTags({
    ActionForbiddenError: (error) =>
      Effect.fail(new RpcActionForbiddenError({ message: error.message })),
    EffectDrizzleQueryError: (error) =>
      Effect.fail(new RpcPersonServiceError({ cause: String(error.cause) })),
  }),
);
