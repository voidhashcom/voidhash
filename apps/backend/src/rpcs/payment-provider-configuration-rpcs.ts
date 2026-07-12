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
import { Effect } from "effect";

export const PaymentProviderConfigurationRpcsLive = PaymentProviderConfigurationRpcsDef.toLayer(
  Effect.gen(function* PaymentProviderConfigurationRpcsLive() {
    const paymentProviderConfigurationService = yield* PaymentProviderConfigurationService;
    const mapUpdateError = (error: unknown) => {
      const tagged = error as {
        readonly _tag?: string;
        readonly cause?: unknown;
        readonly message?: string;
      };
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
          Effect.map((result) => ({ id: (result as { readonly id: string }).id }) as const),
          Effect.mapError(mapUpdateError),
        ),
    };
  }),
);
