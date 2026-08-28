import {
  createdResponse,
  Product,
  ProductPerk,
  ProductType as ProductTypeSchema,
  VoidhashV1Api,
} from "@voidhash/api-contracts";
import {
  ApiActionForbiddenError,
  ApiProductNotFoundError,
  ApiProductPerkAlreadyExistsError,
  ApiProductPerkNotFoundError,
  ApiProductPerkServiceError,
  ApiProductPerkValidationError,
  ApiProductServiceError,
  ApiProductSlugAlreadyExistsError,
  ApiProductValidationError,
} from "@voidhash/api-contracts/errors";
import { ProductPerkService, ProductService } from "@voidhash/core/services";
import { paginate, resolveRequestProjectId } from "@voidhash/core/utils";
import { ProductType, type ProductTypeValue } from "@voidhash/lib";
import { AuthSession } from "@voidhash/rpc";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import {
  type ApiCredentialMethod,
  bridgeAuthSession,
  requireCredential,
} from "../../ApiMiddlewares.ts";

/** Credentials allowed to manage the catalog; publishable keys are public. */
const MANAGEMENT_CREDENTIALS: ReadonlyArray<ApiCredentialMethod> = ["user", "secret-key"];

type ProductTypeLabel = typeof ProductTypeSchema.Type;

/**
 * The public contract speaks in product-type labels while the column stores the
 * `ProductType` smallint, so the boundary translates. Exhaustive over the
 * literal union, hence no fallback branch.
 */
const productTypeFromLabel = (label: ProductTypeLabel): ProductTypeValue => {
  switch (label) {
    case "subscription":
      return ProductType.Subscription;
    case "one-time":
      return ProductType.OneTime;
    case "one-time-consumable":
      return ProductType.OneTimeConsumable;
  }
};

/** Mirrors the service: a duration is only stored for subscriptions. */
const storedDuration = (type: ProductTypeValue, duration: number | undefined): number | null => {
  if (type !== ProductType.Subscription) return null;
  return duration ?? null;
};

export const ProductsGroupLive = HttpApiBuilder.group(VoidhashV1Api, "products", (handlers) =>
  Effect.gen(function* () {
    const productPerkService = yield* ProductPerkService;
    const productService = yield* ProductService;

    return handlers
      .handle("listProducts", ({ query }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            const projectId = yield* resolveRequestProjectId(authSession, query.projectId);
            const products = yield* productService.getProducts(projectId);
            const matching = products.filter(
              (product) => query.type === undefined || product.type === query.type,
            );
            // The service returns rows in database order; pagination cursors
            // only make sense over a stable one.
            const sorted = [...matching].sort((a, b) => a.id.localeCompare(b.id));
            const page = yield* paginate(sorted, (product) => product.id, query);
            return {
              data: page.data.map((product) => new Product(product)),
              pageInfo: page.pageInfo,
            };
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            ProductServiceError: (e) => Effect.fail(new ApiProductServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("createProduct", ({ payload }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            const projectId = yield* resolveRequestProjectId(authSession, payload.projectId);
            const type = productTypeFromLabel(payload.type);
            const created = yield* productService.createProduct({
              duration: payload.duration,
              name: payload.name,
              projectId,
              slug: payload.slug,
              type,
            });
            const product = new Product({
              duration: storedDuration(type, payload.duration),
              id: created.id,
              name: payload.name,
              projectId,
              slug: payload.slug,
              type: payload.type,
            });
            return yield* createdResponse(Product, product, `/products/${product.id}`);
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            ProductServiceError: (e) => Effect.fail(new ApiProductServiceError({ cause: e.cause })),
            ProductSlugAlreadyExistsError: (e) =>
              Effect.fail(new ApiProductSlugAlreadyExistsError({ slug: e.slug })),
            ProductValidationError: (e) =>
              Effect.fail(new ApiProductValidationError({ message: e.message })),
          }),
        ),
      )
      .handle("getProduct", ({ params }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            const product = yield* productService.getProductById(params.productId);
            return new Product(product);
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            ProductNotFoundError: (e) =>
              Effect.fail(new ApiProductNotFoundError({ message: e.message })),
            ProductServiceError: (e) => Effect.fail(new ApiProductServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("updateProduct", ({ params, payload }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            // The service takes a full name/slug pair, so absent fields are
            // filled from the current row to keep PATCH semantics.
            const existing = yield* productService.getProductById(params.productId);
            const name = payload.name ?? existing.name;
            const slug = payload.slug ?? existing.slug;
            yield* productService.updateProduct({ id: params.productId, name, slug });
            return new Product({ ...existing, name, slug });
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            ProductNotFoundError: (e) =>
              Effect.fail(new ApiProductNotFoundError({ message: e.message })),
            ProductServiceError: (e) => Effect.fail(new ApiProductServiceError({ cause: e.cause })),
            ProductSlugAlreadyExistsError: (e) =>
              Effect.fail(new ApiProductSlugAlreadyExistsError({ slug: e.slug })),
          }),
        ),
      )
      .handle("deleteProduct", ({ params }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            yield* productService.deleteProduct({ id: params.productId });
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            ProductNotFoundError: (e) =>
              Effect.fail(new ApiProductNotFoundError({ message: e.message })),
            ProductServiceError: (e) => Effect.fail(new ApiProductServiceError({ cause: e.cause })),
            ProductValidationError: (e) =>
              Effect.fail(new ApiProductValidationError({ message: e.message })),
          }),
        ),
      )
      .handle("listProductPerks", ({ params, query }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            // Resolving the product first turns an unknown id into a 404 on the
            // owning resource rather than a 400 from the link service.
            yield* productService.getProductById(params.productId);
            const links = yield* productPerkService.getProductPerksByProductId(params.productId);
            const page = yield* paginate(links, (link) => link.id, query);
            return {
              data: page.data.map(
                (link) =>
                  new ProductPerk({
                    id: link.id,
                    perkId: link.perkId,
                    productId: link.productId,
                  }),
              ),
              pageInfo: page.pageInfo,
            };
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            ProductNotFoundError: (e) =>
              Effect.fail(new ApiProductNotFoundError({ message: e.message })),
            ProductPerkServiceError: (e) =>
              Effect.fail(new ApiProductPerkServiceError({ cause: e.cause })),
            ProductPerkValidationError: (e) =>
              Effect.fail(new ApiProductPerkValidationError({ message: e.message })),
            ProductServiceError: (e) => Effect.fail(new ApiProductServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("attachProductPerk", ({ params, payload }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            yield* productService.getProductById(params.productId);
            const links = yield* productPerkService.getProductPerksByProductId(params.productId);
            if (links.some((link) => link.perkId === payload.perkId)) {
              return yield* Effect.fail(
                new ApiProductPerkAlreadyExistsError({
                  perkId: payload.perkId,
                  productId: params.productId,
                }),
              );
            }
            const created = yield* productPerkService.createProductPerk({
              perkId: payload.perkId,
              productId: params.productId,
            });
            return new ProductPerk({
              id: created.id,
              perkId: payload.perkId,
              productId: params.productId,
            });
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            ProductNotFoundError: (e) =>
              Effect.fail(new ApiProductNotFoundError({ message: e.message })),
            ProductPerkServiceError: (e) =>
              Effect.fail(new ApiProductPerkServiceError({ cause: e.cause })),
            ProductPerkValidationError: (e) =>
              Effect.fail(new ApiProductPerkValidationError({ message: e.message })),
            ProductServiceError: (e) => Effect.fail(new ApiProductServiceError({ cause: e.cause })),
          }),
        ),
      )
      .handle("detachProductPerk", ({ params }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            yield* productService.getProductById(params.productId);
            const links = yield* productPerkService.getProductPerksByProductId(params.productId);
            // The service deletes by link id; callers of the nested collection
            // address the link by its two owners instead.
            const link = links.find((candidate) => candidate.perkId === params.perkId);
            if (!link) {
              return yield* Effect.fail(
                new ApiProductPerkNotFoundError({
                  message: `Perk ${params.perkId} is not attached to product ${params.productId}`,
                }),
              );
            }
            yield* productPerkService.deleteProductPerk({ id: link.id });
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            ProductNotFoundError: (e) =>
              Effect.fail(new ApiProductNotFoundError({ message: e.message })),
            ProductPerkServiceError: (e) =>
              Effect.fail(new ApiProductPerkServiceError({ cause: e.cause })),
            ProductPerkValidationError: (e) =>
              Effect.fail(new ApiProductPerkValidationError({ message: e.message })),
            ProductServiceError: (e) => Effect.fail(new ApiProductServiceError({ cause: e.cause })),
          }),
        ),
      );
  }),
);
