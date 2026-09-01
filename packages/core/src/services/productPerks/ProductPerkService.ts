import { constant } from "@voidhash/lib/lang";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { AuthSession } from "../../domain/auth/Auth.ts";
import {
  AuditLogAction,
  AuditLogEntityType,
  Db,
  type Product as DbProduct,
  type ProductPerk as DbProductPerk,
  eq,
  productPerks,
} from "@voidhash/db";
import { generateId } from "../../utils/generate-id.ts";
import { checkProjectPermission } from "../../utils/permissions.ts";
import { AuditLogPort } from "../auditLog/AuditLogPort.ts";
import { SchemaCacheInvalidationService } from "../schema/SchemaCacheInvalidationService.ts";

/**
 * Catch-all service error. Wraps `DatabaseError` (and other infrastructural
 * failures) at the public-method boundary so callers see one stable error
 * tag.
 */
export class ProductPerkServiceError extends Schema.TaggedErrorClass<ProductPerkServiceError>(
  "ProductPerkServiceError",
)("ProductPerkServiceError", { cause: Schema.String }) {}

/**
 * Validation error raised when an input refers to a missing product, perk,
 * or product-perk row. Distinct from `ActionForbiddenError`: the row simply
 * doesn't exist.
 */
export class ProductPerkValidationError extends Schema.TaggedErrorClass<ProductPerkValidationError>(
  "ProductPerkValidationError",
)("ProductPerkValidationError", { message: Schema.String }) {}

type DbProductPerkWithProduct = DbProductPerk & { readonly product: DbProduct };

/** The relational query returns a looser row shape than the joined type above. */
const asProductPerkWithProduct = (row: any): Option.Option<DbProductPerkWithProduct> =>
  Option.fromNullishOr(row);

/**
 * `ProductPerkService` orchestrates the (product, perk) join-table
 * aggregate. Three operations: `getProductPerksByProductId`,
 * `createProductPerk`, `deleteProductPerk`. Every write emits an audit-log
 * entry and invalidates the project's cached schema.
 *
 * `AuditLogPort`, `AuthSession`, `Db`, and `SchemaCacheInvalidationService`
 * are provided by the application root.
 */
export class ProductPerkService extends Context.Service<ProductPerkService>()(
  "ProductPerkService",
  {
    make: Effect.gen(function* () {
      const auditLog = yield* AuditLogPort;
      const schemaCache = yield* SchemaCacheInvalidationService;
      const db = yield* Db;

      const getProductPerksByProductId = Effect.fn("getProductPerksByProductId")(
        function* (productId: string) {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan("voidhash.product.id", productId);
          if (session?.user?.id)
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
          if (session?.person?.distinctId)
            yield* Effect.annotateCurrentSpan(
              "voidhash.person.distinct_id",
              session.person.distinctId,
            );
          const product = yield* db.query.products.findFirst({
            where: { id: productId },
          });
          if (!product) {
            return yield* Effect.fail(
              new ProductPerkValidationError({ message: `Product ${productId} not found` }),
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.project.id", product.projectId);
          yield* checkProjectPermission(
            product.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to access product perks for product ${productId}`,
          );
          return yield* db.query.productPerks.findMany({
            orderBy: { createdAt: "asc" },
            where: { productId },
          });
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new ProductPerkServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const createProductPerk = Effect.fn("createProductPerk")(
        function* (input: { readonly productId: string; readonly perkId: string }) {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan("voidhash.product.id", input.productId);
          yield* Effect.annotateCurrentSpan("voidhash.perk.id", input.perkId);
          if (session?.user?.id)
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
          if (session?.person?.distinctId)
            yield* Effect.annotateCurrentSpan(
              "voidhash.person.distinct_id",
              session.person.distinctId,
            );

          const product = yield* db.query.products.findFirst({
            where: { id: input.productId },
          });
          if (!product) {
            return yield* Effect.fail(
              new ProductPerkValidationError({
                message: `Product ${input.productId} not found`,
              }),
            );
          }
          yield* Effect.annotateCurrentSpan("voidhash.project.id", product.projectId);
          yield* checkProjectPermission(
            product.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to create product perks for project ${product.projectId}`,
          );

          const perk = yield* db.query.perks.findFirst({
            where: { id: input.perkId },
          });
          if (!perk) {
            return yield* Effect.fail(
              new ProductPerkValidationError({ message: `Perk ${input.perkId} not found` }),
            );
          }
          yield* checkProjectPermission(
            perk.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to create product perks in project ${product.projectId}`,
          );

          const newProductPerk = {
            id: generateId("productPerk"),
            perkId: input.perkId,
            productId: input.productId,
          };
          yield* Effect.annotateCurrentSpan("voidhash.product_perk.id", newProductPerk.id);
          yield* Effect.annotateCurrentSpan("voidhash.audit.action", AuditLogAction.Created);

          yield* db.insert(productPerks).values(newProductPerk);

          yield* auditLog
            .append({
              projectId: product.projectId,
              entityType: AuditLogEntityType.ProductPerk,
              entityId: newProductPerk.id,
              parentEntityId: input.productId,
              action: AuditLogAction.Created,
            })
            .pipe(Effect.ignore);

          yield* Effect.log(
            `Created product perk ${newProductPerk.id} for product ${input.productId}`,
          );

          yield* schemaCache.invalidate(product.projectId);
          return { id: newProductPerk.id };
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new ProductPerkServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      const deleteProductPerk = Effect.fn("deleteProductPerk")(
        function* (input: { readonly id: string }) {
          const session = yield* AuthSession;
          yield* Effect.annotateCurrentSpan("voidhash.product_perk.id", input.id);
          if (session?.user?.id)
            yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
          if (session?.person?.distinctId)
            yield* Effect.annotateCurrentSpan(
              "voidhash.person.distinct_id",
              session.person.distinctId,
            );

          const productPerk = yield* asProductPerkWithProduct(
            yield* db.query.productPerks.findFirst({
              where: { id: input.id },
              with: { product: true },
            }),
          ).pipe(
            Option.match({
              onNone: () =>
                Effect.fail(
                  new ProductPerkValidationError({
                    message: `Product perk ${input.id} not found`,
                  }),
                ),
              onSome: Effect.succeed,
            }),
          );
          yield* Effect.annotateCurrentSpan("voidhash.product.id", productPerk.productId);
          yield* Effect.annotateCurrentSpan("voidhash.perk.id", productPerk.perkId);
          yield* Effect.annotateCurrentSpan("voidhash.project.id", productPerk.product.projectId);
          yield* Effect.annotateCurrentSpan("voidhash.audit.action", AuditLogAction.Deleted);

          yield* checkProjectPermission(
            productPerk.product.projectId,
            "project:all",
            `User ${session?.user?.id} is not authorized to delete product perks for project ${productPerk.product.projectId}`,
          );

          yield* db.delete(productPerks).where(eq(productPerks.id, input.id));

          yield* auditLog
            .append({
              projectId: productPerk.product.projectId,
              entityType: AuditLogEntityType.ProductPerk,
              entityId: input.id,
              parentEntityId: productPerk.productId,
              action: AuditLogAction.Deleted,
            })
            .pipe(Effect.ignore);

          yield* Effect.log(`Deleted product perk ${input.id}`);
          yield* schemaCache.invalidate(productPerk.product.projectId);
        },
        (effect) =>
          effect.pipe(
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(new ProductPerkServiceError({ cause: String(error.cause) })),
            }),
          ),
      );

      return constant({
        getProductPerksByProductId,
        createProductPerk,
        deleteProductPerk,
      });
    }),
  },
) {
  static layer = Layer.effect(ProductPerkService)(ProductPerkService.make);
}
