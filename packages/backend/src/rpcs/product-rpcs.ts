import { ProductService } from "@voidhash/core/services";
import {
  ProductRpcsDef,
  RpcActionForbiddenError,
  RpcProductNotFoundError,
  RpcProductServiceError,
  RpcProductSlugAlreadyExistsError,
  RpcProductValidationError,
} from "@voidhash/rpc";
import { Effect } from "effect";

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
