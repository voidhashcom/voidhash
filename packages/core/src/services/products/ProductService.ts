import type { ProductTypeValue } from "@voidhash/lib";
import { Context, Effect, Layer, Schema } from "effect";

import { AuthSession } from "../../domain/auth/Auth.ts";
import {
  ProductNotFoundError,
  ProductSlugAlreadyExistsError,
} from "../../domain/product/Product.ts";
import { AuditLogAction, AuditLogEntityType, Db, eq, products } from "@voidhash/db";
import { generateId } from "../../utils/generate-id.ts";
import { checkProjectPermission } from "../../utils/permissions.ts";
import { AuditLogPort } from "../auditLog/AuditLogPort.ts";
import { SchemaCacheInvalidationService } from "../schema/SchemaCacheInvalidationService.ts";
import { type ProductView, dbProductTypeToLabel } from "./helpers.ts";

/**
 * Catch-all service error. Wraps `DatabaseError` (and other infrastructural
 * failures) at the public-method boundary so callers see one stable error
 * tag.
 */
export class ProductServiceError extends Schema.TaggedErrorClass<ProductServiceError>(
  "ProductServiceError",
)("ProductServiceError", { cause: Schema.String }) {}

/**
 * `ProductService` orchestrates the product catalog aggregate. Five
 * operations: `getProducts`, `getProductById`, `createProduct`,
 * `updateProduct`, `deleteProduct`. Every write emits an audit-log entry
 * and invalidates the project's cached schema after the DB write succeeds.
 *
 * `createProduct` re-checks slug uniqueness inside `db.transaction` to
 * close the read-then-write race against a concurrent insert. Other writes
 * call queries directly.
 *
 * `AuditLogPort`, `AuthSession`, `Db`, and `SchemaCacheInvalidationService`
 * are provided by the application root.
 */
export class ProductService extends Context.Service<ProductService>()("ProductService", {
  make: Effect.gen(function* () {
    const auditLog = yield* AuditLogPort;
    const schemaCache = yield* SchemaCacheInvalidationService;
    const db = yield* Db;

    const getProducts = Effect.fn("getProducts")(
      function* (projectId: string) {
        const session = yield* AuthSession;
        yield* Effect.annotateCurrentSpan("voidhash.project.id", projectId);
        if (session?.method)
          yield* Effect.annotateCurrentSpan("voidhash.auth.method", session.method);
        if (session?.user?.id)
          yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        if (session?.person?.distinctId)
          yield* Effect.annotateCurrentSpan(
            "voidhash.person.distinct_id",
            session.person.distinctId,
          );
        if (session?.organizations?.[0]?.id)
          yield* Effect.annotateCurrentSpan(
            "voidhash.organization.id",
            session.organizations[0].id,
          );
        yield* checkProjectPermission(
          projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to access products for project ${projectId}`,
        );
        const rows = yield* db.query.products.findMany({ where: { projectId } });
        return rows.map(
          (product) =>
            ({
              id: product.id,
              name: product.name,
              projectId: product.projectId,
              slug: product.slug,
              type: dbProductTypeToLabel(product.type as ProductTypeValue),
            }) satisfies ProductView,
        );
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new ProductServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    const getProductById = Effect.fn("getProductById")(
      function* (id: string) {
        const session = yield* AuthSession;
        yield* Effect.annotateCurrentSpan("voidhash.product.id", id);
        if (session?.method)
          yield* Effect.annotateCurrentSpan("voidhash.auth.method", session.method);
        if (session?.user?.id)
          yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        if (session?.person?.distinctId)
          yield* Effect.annotateCurrentSpan(
            "voidhash.person.distinct_id",
            session.person.distinctId,
          );
        if (session?.organizations?.[0]?.id)
          yield* Effect.annotateCurrentSpan(
            "voidhash.organization.id",
            session.organizations[0].id,
          );
        const product = yield* db.query.products.findFirst({ where: { id } });
        if (!product) {
          return yield* Effect.fail(new ProductNotFoundError({ message: "Product not found" }));
        }
        yield* Effect.annotateCurrentSpan("voidhash.project.id", product.projectId);
        if (product.slug) yield* Effect.annotateCurrentSpan("voidhash.product.slug", product.slug);
        yield* checkProjectPermission(
          product.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to access product ${id} for project ${product.projectId}`,
        );
        return {
          id: product.id,
          name: product.name,
          projectId: product.projectId,
          slug: product.slug,
          type: dbProductTypeToLabel(product.type as ProductTypeValue),
        } satisfies ProductView;
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new ProductServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    const createProduct = Effect.fn("createProduct")(
      function* (input: {
        readonly projectId: string;
        readonly name: string;
        readonly slug: string;
      }) {
        const session = yield* AuthSession;
        yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
        yield* Effect.annotateCurrentSpan("voidhash.product.slug", input.slug);
        if (session?.method)
          yield* Effect.annotateCurrentSpan("voidhash.auth.method", session.method);
        if (session?.user?.id)
          yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        if (session?.person?.distinctId)
          yield* Effect.annotateCurrentSpan(
            "voidhash.person.distinct_id",
            session.person.distinctId,
          );
        if (session?.organizations?.[0]?.id)
          yield* Effect.annotateCurrentSpan(
            "voidhash.organization.id",
            session.organizations[0].id,
          );
        yield* checkProjectPermission(
          input.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to create products for project ${input.projectId}`,
        );

        const productId = generateId("product");
        yield* Effect.annotateCurrentSpan("voidhash.product.id", productId);

        yield* db.transaction((tx) =>
          Effect.gen(function* () {
            const existing = yield* tx.query.products.findFirst({
              where: { slug: input.slug, projectId: input.projectId },
            });
            if (existing) {
              return yield* Effect.fail(new ProductSlugAlreadyExistsError({ slug: input.slug }));
            }
            yield* tx.insert(products).values({
              id: productId,
              name: input.name,
              projectId: input.projectId,
              slug: input.slug,
            });
          }),
        );

        yield* auditLog
          .append({
            projectId: input.projectId,
            entityType: AuditLogEntityType.Product,
            entityId: productId,
            action: AuditLogAction.Created,
            changes: { snapshot: { name: input.name, slug: input.slug } },
          })
          .pipe(Effect.ignore);

        yield* Effect.log(`Created product ${productId} for project ${input.projectId}`);
        yield* schemaCache.invalidate(input.projectId);
        return { id: productId };
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new ProductServiceError({ cause: String(error.cause) })),
            SqlError: (error) =>
              Effect.fail(new ProductServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    const updateProduct = Effect.fn("updateProduct")(
      function* (input: { readonly id: string; readonly name: string; readonly slug?: string }) {
        const session = yield* AuthSession;
        yield* Effect.annotateCurrentSpan("voidhash.product.id", input.id);
        if (input.slug) yield* Effect.annotateCurrentSpan("voidhash.product.slug", input.slug);
        if (session?.method)
          yield* Effect.annotateCurrentSpan("voidhash.auth.method", session.method);
        if (session?.user?.id)
          yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        if (session?.person?.distinctId)
          yield* Effect.annotateCurrentSpan(
            "voidhash.person.distinct_id",
            session.person.distinctId,
          );
        if (session?.organizations?.[0]?.id)
          yield* Effect.annotateCurrentSpan(
            "voidhash.organization.id",
            session.organizations[0].id,
          );
        const existing = yield* db.query.products.findFirst({ where: { id: input.id } });
        if (!existing) {
          return yield* Effect.fail(
            new ProductNotFoundError({ message: `Product ${input.id} not found` }),
          );
        }
        yield* Effect.annotateCurrentSpan("voidhash.project.id", existing.projectId);
        yield* checkProjectPermission(
          existing.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to update product ${input.id} for project ${existing.projectId}`,
        );

        yield* db
          .update(products)
          .set({ name: input.name, slug: input.slug, updatedAt: new Date() })
          .where(eq(products.id, input.id));

        yield* auditLog
          .append({
            projectId: existing.projectId,
            entityType: AuditLogEntityType.Product,
            entityId: input.id,
            action: AuditLogAction.Updated,
            changes: { snapshot: { name: input.name, slug: input.slug } },
          })
          .pipe(Effect.ignore);

        yield* Effect.log(`Updated product ${input.id} for project ${existing.projectId}`);
        yield* schemaCache.invalidate(existing.projectId);
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new ProductServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    const deleteProduct = Effect.fn("deleteProduct")(
      function* (input: { readonly id: string }) {
        const session = yield* AuthSession;
        yield* Effect.annotateCurrentSpan("voidhash.product.id", input.id);
        if (session?.method)
          yield* Effect.annotateCurrentSpan("voidhash.auth.method", session.method);
        if (session?.user?.id)
          yield* Effect.annotateCurrentSpan("voidhash.user.id", session.user.id);
        if (session?.person?.distinctId)
          yield* Effect.annotateCurrentSpan(
            "voidhash.person.distinct_id",
            session.person.distinctId,
          );
        if (session?.organizations?.[0]?.id)
          yield* Effect.annotateCurrentSpan(
            "voidhash.organization.id",
            session.organizations[0].id,
          );
        const existing = yield* db.query.products.findFirst({ where: { id: input.id } });
        if (!existing) {
          return yield* Effect.fail(
            new ProductNotFoundError({ message: `Product ${input.id} not found` }),
          );
        }
        yield* Effect.annotateCurrentSpan("voidhash.project.id", existing.projectId);
        yield* checkProjectPermission(
          existing.projectId,
          "project:all",
          `User ${session?.user?.id} is not authorized to delete product ${input.id} for project ${existing.projectId}`,
        );

        yield* db.delete(products).where(eq(products.id, input.id));

        yield* auditLog
          .append({
            projectId: existing.projectId,
            entityType: AuditLogEntityType.Product,
            entityId: input.id,
            action: AuditLogAction.Deleted,
          })
          .pipe(Effect.ignore);

        yield* Effect.log(`Deleted product ${input.id} for project ${existing.projectId}`);
        yield* schemaCache.invalidate(existing.projectId);
      },
      (effect) =>
        effect.pipe(
          Effect.catchTags({
            EffectDrizzleQueryError: (error) =>
              Effect.fail(new ProductServiceError({ cause: String(error.cause) })),
          }),
        ),
    );

    return {
      getProducts,
      getProductById,
      createProduct,
      updateProduct,
      deleteProduct,
    } as const;
  }),
}) {
  static layer = Layer.effect(ProductService)(ProductService.make);
}

export type { ProductTypeLabel, ProductView } from "./helpers.ts";
