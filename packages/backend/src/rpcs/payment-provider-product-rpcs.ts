import { PaymentProviderProductService } from "@voidhash/core-v2";
import {
  PaymentProviderProductRpcsDef,
  RpcActionForbiddenError,
  RpcPaymentProviderProductNotFoundError,
  RpcPaymentProviderProductServiceError,
  RpcPaymentProviderProductValidationError,
} from "@voidhash/rpc";
import { constant } from "@voidhash/lib/lang";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as Match from "effect/Match";

/** Structural view of the service errors these RPCs re-map onto wire errors. */
interface TaggedErrorLike {
  readonly _tag?: string;
  readonly cause?: unknown;
  readonly message?: string;
}

const isTaggedErrorLike = (error: unknown): error is TaggedErrorLike =>
  P.isObject(error) && error !== null;

const taggedErrorFields = (error: unknown): TaggedErrorLike => {
  if (isTaggedErrorLike(error)) return error;
  return {};
};

export const PaymentProviderProductRpcsLive = PaymentProviderProductRpcsDef.toLayer(
  Effect.gen(function* PaymentProviderProductRpcsLive() {
    const paymentProviderProductService = yield* PaymentProviderProductService;
    const mapCreateError = (error: unknown) => {
      const tagged = taggedErrorFields(error);
      return Match.value(tagged).pipe(
        Match.when({ _tag: "PurchaseActionForbiddenError" }, () => new RpcActionForbiddenError({ message: tagged.message ?? "" })),
        Match.when({ _tag: "PaymentProviderProductNotFoundError" }, () => new RpcPaymentProviderProductNotFoundError({ message: tagged.message ?? "" })),
        Match.when({ _tag: "PaymentProviderProductValidationError" }, () => new RpcPaymentProviderProductValidationError({ message: tagged.message ?? "" })),
        Match.orElse(() => new RpcPaymentProviderProductServiceError({
            cause: String(tagged.cause ?? error),
          })),
      );
    };
    const mapUpdateError = (error: unknown) => {
      const tagged = taggedErrorFields(error);
      return Match.value(tagged).pipe(
        Match.when({ _tag: "PurchaseActionForbiddenError" }, () => new RpcActionForbiddenError({ message: tagged.message ?? "" })),
        Match.when({ _tag: "PaymentProviderProductNotFoundError" }, () => new RpcPaymentProviderProductNotFoundError({ message: tagged.message ?? "" })),
        Match.when({ _tag: "PaymentProviderProductValidationError" }, () => new RpcPaymentProviderProductValidationError({ message: tagged.message ?? "" })),
        Match.orElse(() => new RpcPaymentProviderProductServiceError({
            cause: String(tagged.cause ?? error),
          })),
      );
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
            PurchaseActionForbiddenError: (error) =>
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
            PurchaseActionForbiddenError: (error) =>
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
            PurchaseActionForbiddenError: (error) =>
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
