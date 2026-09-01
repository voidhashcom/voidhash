import { PaymentProviderConfigurationService } from "@voidhash/core-v2";
import {
  PaymentProviderConfigurationRpcsDef,
  RpcActionForbiddenError,
  RpcPaymentProviderAlreadyExistsError,
  RpcPaymentProviderConfigurationInUseError,
  RpcPaymentProviderConfigurationKeyUnavailableError,
  RpcPaymentProviderConfigurationNotFoundError,
  RpcPaymentProviderConfigurationServiceError,
  RpcPaymentProviderConfigurationValidationError,
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

export const PaymentProviderConfigurationRpcsLive = PaymentProviderConfigurationRpcsDef.toLayer(
  Effect.gen(function* PaymentProviderConfigurationRpcsLive() {
    const paymentProviderConfigurationService = yield* PaymentProviderConfigurationService;
    const mapUpdateError = (error: unknown) => {
      const tagged = taggedErrorFields(error);
      return Match.value(tagged).pipe(
        Match.when(
          { _tag: "PurchaseActionForbiddenError" },
          () => new RpcActionForbiddenError({ message: tagged.message ?? "" }),
        ),
        Match.when(
          { _tag: "PaymentProviderConfigurationKeyUnavailableError" },
          () =>
            new RpcPaymentProviderConfigurationKeyUnavailableError({
              message: tagged.message ?? "",
            }),
        ),
        Match.when(
          { _tag: "PaymentProviderConfigurationNotFoundError" },
          () =>
            new RpcPaymentProviderConfigurationNotFoundError({
              message: tagged.message ?? "",
            }),
        ),
        Match.when(
          { _tag: "PaymentProviderConfigurationValidationError" },
          () =>
            new RpcPaymentProviderConfigurationValidationError({
              cause: String(tagged.cause ?? error),
            }),
        ),
        Match.orElse(
          () =>
            new RpcPaymentProviderConfigurationServiceError({
              cause: String(tagged.cause ?? error),
            }),
        ),
      );
    };
    return {
      CreatePaymentProviderConfiguration: (input) =>
        paymentProviderConfigurationService.createPaymentProviderConfiguration(input).pipe(
          Effect.catchTags({
            PurchaseActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaymentProviderAlreadyExistsError: (error) =>
              Effect.fail(new RpcPaymentProviderAlreadyExistsError({ message: error.message })),
            PaymentProviderConfigurationServiceError: (error) =>
              Effect.fail(new RpcPaymentProviderConfigurationServiceError({ cause: error.cause })),
            PaymentProviderConfigurationValidationError: (error) =>
              Effect.fail(
                new RpcPaymentProviderConfigurationValidationError({ cause: error.cause }),
              ),
          }),
        ),
      DeletePaymentProviderConfiguration: (input) =>
        paymentProviderConfigurationService.deletePaymentProviderConfiguration(input).pipe(
          Effect.catchTags({
            PurchaseActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaymentProviderConfigurationInUseError: (error) =>
              Effect.fail(
                new RpcPaymentProviderConfigurationInUseError({ message: error.message }),
              ),
            PaymentProviderConfigurationNotFoundError: (error) =>
              Effect.fail(
                new RpcPaymentProviderConfigurationNotFoundError({ message: error.message }),
              ),
            PaymentProviderConfigurationServiceError: (error) =>
              Effect.fail(new RpcPaymentProviderConfigurationServiceError({ cause: error.cause })),
          }),
        ),
      GetPaymentProviderConfiguration: ({ id }) =>
        paymentProviderConfigurationService.getPaymentProviderConfigurationById(id).pipe(
          Effect.catchTags({
            PurchaseActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaymentProviderConfigurationNotFoundError: (error) =>
              Effect.fail(
                new RpcPaymentProviderConfigurationNotFoundError({ message: error.message }),
              ),
            PaymentProviderConfigurationServiceError: (error) =>
              Effect.fail(new RpcPaymentProviderConfigurationServiceError({ cause: error.cause })),
          }),
        ),
      ListPaymentProviderConfigurations: ({ projectId }) =>
        paymentProviderConfigurationService.getPaymentProviderConfigurations(projectId).pipe(
          Effect.catchTags({
            PurchaseActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaymentProviderConfigurationServiceError: (error) =>
              Effect.fail(new RpcPaymentProviderConfigurationServiceError({ cause: error.cause })),
          }),
        ),
      UpdatePaymentProviderConfiguration: ({ isEnabled, ...input }) =>
        paymentProviderConfigurationService
          .updatePaymentProviderConfiguration({ ...input, enabled: isEnabled })
          .pipe(
            Effect.map((result) => constant({ id: result.id })),
            Effect.mapError(mapUpdateError),
          ),
    };
  }),
);
