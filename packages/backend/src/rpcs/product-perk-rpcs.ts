import { ProductPerkService } from "@voidhash/core/services";
import {
  ProductPerkRpcsDef,
  RpcActionForbiddenError,
  RpcProductPerkServiceError,
  RpcProductPerkValidationError,
} from "@voidhash/rpc";
import { Effect } from "effect";

export const ProductPerkRpcsLive = ProductPerkRpcsDef.toLayer(
  Effect.gen(function* ProductPerkRpcsLive() {
    const productPerkService = yield* ProductPerkService;
    return {
      CreateProductPerk: (input) =>
        productPerkService.createProductPerk(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            ProductPerkServiceError: (error) =>
              Effect.fail(new RpcProductPerkServiceError({ cause: error.cause })),
            ProductPerkValidationError: (error) =>
              Effect.fail(new RpcProductPerkValidationError({ message: error.message })),
          }),
          Effect.asVoid,
        ),
      DeleteProductPerk: (input) =>
        productPerkService.deleteProductPerk(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            ProductPerkServiceError: (error) =>
              Effect.fail(new RpcProductPerkServiceError({ cause: error.cause })),
            ProductPerkValidationError: (error) =>
              Effect.fail(new RpcProductPerkValidationError({ message: error.message })),
          }),
        ),
      ListProductPerksByProductId: ({ productId }) =>
        productPerkService.getProductPerksByProductId(productId).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            ProductPerkServiceError: (error) =>
              Effect.fail(new RpcProductPerkServiceError({ cause: error.cause })),
            ProductPerkValidationError: (error) =>
              Effect.fail(new RpcProductPerkValidationError({ message: error.message })),
          }),
        ),
    };
  }),
);
