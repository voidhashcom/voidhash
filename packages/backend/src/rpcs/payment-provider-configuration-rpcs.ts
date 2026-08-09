import { PaymentProviderConfigurationService } from "@voidhash/core/services";
import {
  PaymentProviderConfigurationRpcsDef,
  RpcActionForbiddenError,
  RpcPaymentProviderAlreadyExistsError,
  RpcPaymentProviderConfigurationKeyUnavailableError,
  RpcPaymentProviderConfigurationNotFoundError,
  RpcPaymentProviderConfigurationServiceError,
  RpcPaymentProviderConfigurationValidationError,
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

export const PaymentProviderConfigurationRpcsLive = PaymentProviderConfigurationRpcsDef.toLayer(
  Effect.gen(function* PaymentProviderConfigurationRpcsLive() {
    const paymentProviderConfigurationService = yield* PaymentProviderConfigurationService;
    const mapUpdateError = (error: unknown) => {
      const tagged = taggedErrorFields(error);
      switch (tagged._tag) {
        case "ActionForbiddenError":
          return new RpcActionForbiddenError({ message: tagged.message ?? "" });
        case "PaymentProviderConfigurationKeyUnavailableError":
          return new RpcPaymentProviderConfigurationKeyUnavailableError({
            message: tagged.message ?? "",
          });
        case "PaymentProviderConfigurationNotFoundError":
          return new RpcPaymentProviderConfigurationNotFoundError({
            message: tagged.message ?? "",
          });
        case "PaymentProviderConfigurationValidationError":
          return new RpcPaymentProviderConfigurationValidationError({
            cause: String(tagged.cause ?? error),
          });
        default:
          return new RpcPaymentProviderConfigurationServiceError({
            cause: String(tagged.cause ?? error),
          });
      }
    };
    return {
      CreatePaymentProviderConfiguration: (input) =>
        paymentProviderConfigurationService.createPaymentProviderConfiguration(input).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
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
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
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
            ActionForbiddenError: (error) =>
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
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaymentProviderConfigurationServiceError: (error) =>
              Effect.fail(new RpcPaymentProviderConfigurationServiceError({ cause: error.cause })),
          }),
        ),
      UpdatePaymentProviderConfiguration: (input) =>
        paymentProviderConfigurationService.updatePaymentProviderConfiguration(input).pipe(
          Effect.map((result) => constant({ id: result.id })),
          Effect.mapError(mapUpdateError),
        ),
    };
  }),
);
