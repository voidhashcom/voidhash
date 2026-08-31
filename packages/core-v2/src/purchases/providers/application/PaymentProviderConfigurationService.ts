import { Context, Effect, Layer, Schema } from "effect";

import {
  PaymentProviderConfigurationOperations,
  type PaymentProviderConfigurationOperationsShape,
} from "../../application/ports/PaymentProviderManagementOperations.ts";
import {
  PaymentProviderConfigurationServiceError,
  PaymentProviderConfigurationValidationError,
  PaymentProviderId,
} from "../../domain/ProviderConfiguration.ts";

const Id = Schema.NonEmptyString;
const CreateInput = Schema.Struct({ projectId: Id, providerId: PaymentProviderId });
const DeleteInput = Schema.Struct({ paymentProviderConfigurationId: Id });
const UpdateInput = Schema.Struct({
  configuration: Schema.Record(Schema.String, Schema.Unknown),
  enabled: Schema.Boolean,
  id: Id,
  name: Schema.optional(Schema.String),
});

export type PaymentProviderConfigurationServiceShape = PaymentProviderConfigurationOperationsShape;

const makePaymentProviderConfigurationService = Effect.gen(function* () {
  const operations = yield* PaymentProviderConfigurationOperations;
  const invalid = (error: unknown) =>
    new PaymentProviderConfigurationServiceError({ cause: String(error) });

  return {
    createPaymentProviderConfiguration: (input) =>
      Schema.decodeUnknownEffect(CreateInput)(input).pipe(
        Effect.mapError(
          (error) => new PaymentProviderConfigurationValidationError({ cause: String(error) }),
        ),
        Effect.flatMap(operations.createPaymentProviderConfiguration),
      ),
    deletePaymentProviderConfiguration: (input) =>
      Schema.decodeUnknownEffect(DeleteInput)(input).pipe(
        Effect.mapError(invalid),
        Effect.flatMap(operations.deletePaymentProviderConfiguration),
      ),
    getPaymentProviderConfigurationById: (id) =>
      Schema.decodeUnknownEffect(Id)(id).pipe(
        Effect.mapError(invalid),
        Effect.flatMap(operations.getPaymentProviderConfigurationById),
      ),
    getPaymentProviderConfigurations: (projectId) =>
      Schema.decodeUnknownEffect(Id)(projectId).pipe(
        Effect.mapError(invalid),
        Effect.flatMap(operations.getPaymentProviderConfigurations),
      ),
    updatePaymentProviderConfiguration: (input) =>
      Schema.decodeUnknownEffect(UpdateInput)(input).pipe(
        Effect.mapError(invalid),
        Effect.flatMap(operations.updatePaymentProviderConfiguration),
      ),
  } satisfies PaymentProviderConfigurationServiceShape;
});

export class PaymentProviderConfigurationService extends Context.Service<
  PaymentProviderConfigurationService,
  PaymentProviderConfigurationServiceShape
>()("@voidhash/core-v2/purchases/PaymentProviderConfigurationService", {
  make: makePaymentProviderConfigurationService,
}) {
  static readonly layer = Layer.effect(PaymentProviderConfigurationService)(
    PaymentProviderConfigurationService.make,
  );
}
