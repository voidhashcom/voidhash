import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

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
  isEnabled: Schema.Boolean,
  id: Id,
  name: Schema.optional(Schema.String),
}).pipe(Schema.encodeKeys({ isEnabled: "enabled" }));

export type PaymentProviderConfigurationServiceShape = PaymentProviderConfigurationOperationsShape;

const makePaymentProviderConfigurationService = Effect.fn(
  "makePaymentProviderConfigurationService",
)(function* () {
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
        Effect.flatMap(({ isEnabled, ...update }) =>
          operations.updatePaymentProviderConfiguration({ ...update, enabled: isEnabled }),
        ),
      ),
  } satisfies PaymentProviderConfigurationServiceShape;
})();

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
