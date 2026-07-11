import { PaymentProviderProductService } from "@voidhash/core/services";
import {
  PaymentProviderProductRpcsDef,
  RpcActionForbiddenError,
  RpcPaymentProviderProductNotFoundError,
  RpcPaymentProviderProductServiceError,
  RpcPaymentProviderProductValidationError,
} from "@voidhash/rpc";
import { Effect } from "effect";

export const PaymentProviderProductRpcsLive = PaymentProviderProductRpcsDef.toLayer(
  Effect.gen(function* PaymentProviderProductRpcsLive() {
    const paymentProviderProductService = yield* PaymentProviderProductService;
    const mapCreateError = (error: unknown) => {
      const tagged = error as {
        readonly _tag?: string;
        readonly cause?: unknown;
        readonly message?: string;
      };
      switch (tagged._tag) {
        case "ActionForbiddenError":
          return new RpcActionForbiddenError({ message: tagged.message ?? "" });
        case "PaymentProviderProductValidationError":
          return new RpcPaymentProviderProductValidationError({ message: tagged.message ?? "" });
        default:
          return new RpcPaymentProviderProductServiceError({
            cause: String(tagged.cause ?? error),
          });
      }
    };
    const mapUpdateError = (error: unknown) => {
      const tagged = error as {
        readonly _tag?: string;
        readonly cause?: unknown;
        readonly message?: string;
      };
      switch (tagged._tag) {
        case "ActionForbiddenError":
          return new RpcActionForbiddenError({ message: tagged.message ?? "" });
        case "PaymentProviderProductNotFoundError":
          return new RpcPaymentProviderProductNotFoundError({ message: tagged.message ?? "" });
        case "PaymentProviderProductValidationError":
          return new RpcPaymentProviderProductValidationError({ message: tagged.message ?? "" });
        default:
          return new RpcPaymentProviderProductServiceError({
            cause: String(tagged.cause ?? error),
          });
      }
    };
    return {
      CreatePaymentProviderProduct: (input) =>
        paymentProviderProductService.createPaymentProviderProduct(input).pipe(
          Effect.map((result) => ({ id: (result as { readonly id: string }).id }) as const),
          Effect.mapError(mapCreateError),
        ),
      DeletePaymentProviderProduct: (input) =>
        paymentProviderProductService.deletePaymentProviderProduct(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaymentProviderProductServiceError: (error) =>
              Effect.fail(new RpcPaymentProviderProductServiceError({ cause: error.cause })),
            PaymentProviderProductValidationError: (error) =>
              Effect.fail(new RpcPaymentProviderProductValidationError({ message: error.message })),
          }),
        ),
      ListProviderProductsByProductId: ({ productId }) =>
        paymentProviderProductService.getProviderProductsByProductId(productId).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaymentProviderProductServiceError: (error) =>
              Effect.fail(new RpcPaymentProviderProductServiceError({ cause: error.cause })),
            PaymentProviderProductValidationError: (error) =>
              Effect.fail(new RpcPaymentProviderProductValidationError({ message: error.message })),
          }),
        ),
      SetActivePaymentProviderProduct: (input) =>
        paymentProviderProductService.setActivePaymentProviderProduct(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaymentProviderProductServiceError: (error) =>
              Effect.fail(new RpcPaymentProviderProductServiceError({ cause: error.cause })),
            PaymentProviderProductValidationError: (error) =>
              Effect.fail(new RpcPaymentProviderProductValidationError({ message: error.message })),
          }),
        ),
      UpdatePaymentProviderProduct: (input) =>
        paymentProviderProductService
          .updatePaymentProviderProduct(input)
          .pipe(Effect.mapError(mapUpdateError), Effect.asVoid),
    };
  }),
);
