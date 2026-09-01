import { ProductService, type ProductView } from "@voidhash/core/services";
import {
  ProductRpcsDef,
  RpcActionForbiddenError,
  RpcProductNotFoundError,
  RpcProductServiceError,
  RpcProductSlugAlreadyExistsError,
  RpcProductValidationError,
} from "@voidhash/rpc";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

/** Converts the domain's explicit duration absence to the nullable RPC schema. */
const toRpcProduct = (product: ProductView) => ({
  ...product,
  duration: Option.getOrNull(product.duration),
});

export const ProductRpcsLive = ProductRpcsDef.toLayer(
  Effect.gen(function* ProductRpcsLive() {
    const productService = yield* ProductService;
    return {
      CreateProduct: (input) =>
        productService.createProduct(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            ProductServiceError: (error) =>
              Effect.fail(new RpcProductServiceError({ cause: error.cause })),
            ProductSlugAlreadyExistsError: (error) =>
              Effect.fail(new RpcProductSlugAlreadyExistsError({ slug: error.slug })),
            ProductValidationError: (error) =>
              Effect.fail(new RpcProductValidationError({ message: error.message })),
          }),
        ),
      DeleteProduct: (input) =>
        productService.deleteProduct(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            ProductNotFoundError: (error) =>
              Effect.fail(new RpcProductNotFoundError({ message: error.message })),
            ProductServiceError: (error) =>
              Effect.fail(new RpcProductServiceError({ cause: error.cause })),
            ProductValidationError: (error) =>
              Effect.fail(new RpcProductValidationError({ message: error.message })),
          }),
        ),
      GetProduct: ({ id }) =>
        productService.getProductById(id).pipe(
          Effect.map(toRpcProduct),
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            ProductNotFoundError: (error) =>
              Effect.fail(new RpcProductNotFoundError({ message: error.message })),
            ProductServiceError: (error) =>
              Effect.fail(new RpcProductServiceError({ cause: error.cause })),
          }),
        ),
      ListProducts: ({ projectId }) =>
        productService.getProducts(projectId).pipe(
          Effect.map((products) => products.map(toRpcProduct)),
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            ProductServiceError: (error) =>
              Effect.fail(new RpcProductServiceError({ cause: error.cause })),
          }),
        ),
      UpdateProduct: (input) =>
        productService.updateProduct(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            ProductNotFoundError: (error) =>
              Effect.fail(new RpcProductNotFoundError({ message: error.message })),
            ProductServiceError: (error) =>
              Effect.fail(new RpcProductServiceError({ cause: error.cause })),
            ProductSlugAlreadyExistsError: (error) =>
              Effect.fail(new RpcProductSlugAlreadyExistsError({ slug: error.slug })),
          }),
        ),
    };
  }),
);
