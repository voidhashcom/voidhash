import { PaymentProviderProductService } from "@voidhash/core-v2";
import {
  PaymentProviderProductRpcsDef,
  RpcActionForbiddenError,
  RpcPaymentProviderProductNotFoundError,
  RpcPaymentProviderProductServiceError,
  RpcPaymentProviderProductValidationError,
} from "@voidhash/rpc";
import { constant } from "@voidhash/lib/lang";
import { Effect } from "effect";

/** Structural view of the service errors these RPCs re-map onto wire errors. */
interface TaggedErrorLike {
  readonly _tag?: string;
  readonly cause?: unknown;
  readonly message?: string;
}

const isTaggedErrorLike = (error: unknown): error is TaggedErrorLike =>
  typeof error === "object" && error !== null;

const taggedErrorFields = (error: unknown): TaggedErrorLike => {
  if (isTaggedErrorLike(error)) return error;
  return {};
};

export const PaymentProviderProductRpcsLive = PaymentProviderProductRpcsDef.toLayer(
  Effect.gen(function* PaymentProviderProductRpcsLive() {
    const paymentProviderProductService = yield* PaymentProviderProductService;
    const mapCreateError = (error: unknown) => {
      const tagged = taggedErrorFields(error);
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
    const mapUpdateError = (error: unknown) => {
      const tagged = taggedErrorFields(error);
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
          Effect.map((result) => constant({ id: result.id })),
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
